import makeDebug from "debug";
import type { CDP } from "../cdp";
import type { NetworkEvents } from "../cdp/domains/network";
import type { PageEvents } from "../cdp/domains/page";
import type { TargetEvents } from "../cdp/domains/target";
import type {
    CDPBrowserContextId,
    CDPFrameId,
    CDPNetworkHeaders,
    CDPNetworkRequest,
    CDPNetworkResourceTiming,
    CDPNetworkResponse,
    CDPSessionId,
    CDPTargetInfo,
} from "../cdp/types";
import type {
    NetworkHeader,
    NetworkEventSource,
    NetworkEventSourceHandlers,
    NetworkRequest,
    NetworkResponse,
    NetworkTiming,
    NetworkSettings,
} from "./types";
import * as logger from "../../utils/logger";
import { promiseTimeout } from "../../utils/promise";

const debug = makeDebug("testplane:time-travel:network");
const BODY_DRAIN_TIMEOUT_MS = 250;

interface TrackedRequest {
    request: NetworkRequest;
    timestamp: number;
    finished: Promise<string | null>;
    finish: (error: string | null) => void;
    sessionId: CDPSessionId;
    navigationFrameId?: CDPFrameId;
    response?: NetworkResponse;
    requestHeaders: NetworkHeader[];
    resourceType?: string;
    responseHeaders?: NetworkHeader[];
    networkStatus?: number;
    failureDetails?: NetworkRequest["failureDetails"];
    expectsExtraInfo?: boolean;
    failed?: boolean;
    responseBodySize: number;
}

interface RequestChain {
    requestId: string;
    hops: TrackedRequest[];
    requestHeaders: NetworkEvents["requestWillBeSentExtraInfo"][];
    responses: NetworkEvents["responseReceivedExtraInfo"][];
}

interface TargetSession {
    parentId: CDPSessionId;
    type: CDPTargetInfo["type"];
    requests: Map<string, TrackedRequest>;
    bodyReads: Set<() => void>;
    chains: Map<string, RequestChain>;
}

const headersToArray = (headers: CDPNetworkHeaders): NetworkHeader[] =>
    Object.entries(headers).flatMap(([name, value]) =>
        String(value)
            .split("\n")
            .map(value => ({ name: name.toLowerCase(), value })),
    );

const consumeOnce = <T>(read: (() => Promise<T>) | undefined): (() => Promise<T>) => {
    return async () => {
        if (!read) {
            throw new Error("Body already consumed");
        }
        const consume = read;
        read = undefined;
        return consume();
    };
};

export class CdpNetworkEventSource implements NetworkEventSource {
    private readonly _cdp: CDP;
    private readonly _session: WebdriverIO.Browser;
    private readonly _maxBodySizeBytes: number;
    private readonly _sessions = new Map<CDPSessionId, TargetSession>();
    private readonly _chains = new Set<RequestChain>();
    private readonly _contexts = new Set<CDPBrowserContextId | undefined>();
    private readonly _targetTasks = new Set<Promise<void>>();
    private readonly _bodyReads = new Set<Promise<Buffer | null>>();
    private _handlers?: NetworkEventSourceHandlers;
    private _browserSessionId?: CDPSessionId;
    private _starting = false;
    private _startError?: unknown;
    private _stopping = false;
    private _stopPromise?: Promise<void>;

    constructor(cdp: CDP, session: WebdriverIO.Browser, { maxBodySizeBytes }: NetworkSettings) {
        this._cdp = cdp;
        this._session = session;
        this._maxBodySizeBytes = maxBodySizeBytes;
    }

    async start(handlers: NetworkEventSourceHandlers): Promise<void> {
        const handles = await this._session.getWindowHandles();
        const { targetInfos } = await this._cdp.target.getTargets();
        const pages = targetInfos.filter(
            ({ targetId, type }) =>
                type === "page" && handles.some(handle => handle === targetId || handle === `CDwindow-${targetId}`),
        );
        if (!pages.length) {
            throw new Error(`Could not find CDP targets for windows ${handles.join(", ")}`);
        }

        for (const page of pages) {
            this._contexts.add(page.browserContextId);
        }
        this._starting = true;

        this._browserSessionId = (
            await this._cdp.request<{ sessionId: CDPSessionId }>("Target.attachToBrowserTarget")
        ).sessionId;
        this._handlers = handlers;
        this._cdp.target.on("attachedToTarget", this._onAttached);
        this._cdp.target.on("detachedFromTarget", this._onDetached);
        this._cdp.page.on("frameAttached", this._onFrameAttached);
        this._cdp.network.on("requestWillBeSent", this._onRequest);
        this._cdp.network.on("responseReceived", this._onResponse);
        this._cdp.network.on("requestWillBeSentExtraInfo", this._onRequestExtraInfo);
        this._cdp.network.on("responseReceivedExtraInfo", this._onResponseExtraInfo);
        this._cdp.network.on("dataReceived", this._onData);
        this._cdp.network.on("loadingFinished", this._onFinished);
        this._cdp.network.on("loadingFailed", this._onFailed);

        try {
            await this._autoAttach(this._browserSessionId, ["page", "shared_worker", "service_worker"]);
            await this._awaitTargetTasks();
            if (this._startError) {
                throw this._startError;
            }
        } catch (error) {
            await this.stop();
            throw error;
        } finally {
            this._starting = false;
        }
    }

    stop(): Promise<void> {
        return (this._stopPromise ??= this._stop());
    }

    [Symbol.asyncDispose](): Promise<void> {
        return this.stop();
    }

    private async _stop(): Promise<void> {
        const browserSessionId = this._browserSessionId;
        if (!browserSessionId) {
            return;
        }

        this._stopping = true;
        await this._awaitTargetTasks();
        this._cdp.network.off("requestWillBeSent", this._onRequest);
        this._cdp.network.off("responseReceived", this._onResponse);
        this._cdp.network.off("requestWillBeSentExtraInfo", this._onRequestExtraInfo);
        this._cdp.network.off("responseReceivedExtraInfo", this._onResponseExtraInfo);
        try {
            this._reconcile(true);
        } catch (error) {
            debug("Final network metadata reconciliation failed: %O", error);
        }
        this._chains.clear();

        // A WebDriver command may finish before CDP delivers loadingFinished on its own connection.
        // Keep terminal events and size accounting live for current reads, but don't wait for streams forever.
        if (this._bodyReads.size) {
            await promiseTimeout(
                Promise.allSettled(this._bodyReads),
                BODY_DRAIN_TIMEOUT_MS,
                "Network body reads are still pending at shutdown",
            ).catch(error => debug("%s", error.message));
        }

        this._cdp.network.off("dataReceived", this._onData);
        this._cdp.network.off("loadingFinished", this._onFinished);
        this._cdp.network.off("loadingFailed", this._onFailed);
        for (const session of this._sessions.values()) {
            for (const request of session.requests.values()) {
                request.finish("Network monitoring stopped before the request finished");
            }
            session.requests.clear();
        }
        await Promise.allSettled(this._bodyReads);
        // Detaching the owning browser session also detaches its auto-attached descendants.
        await this._cdp.target.detachFromTarget(browserSessionId).catch(() => {});
        await this._awaitTargetTasks();
        this._cdp.target.off("attachedToTarget", this._onAttached);
        this._cdp.target.off("detachedFromTarget", this._onDetached);
        this._cdp.page.off("frameAttached", this._onFrameAttached);
        for (const sessionId of this._sessions.keys()) {
            this._removeSession(sessionId);
        }
        this._browserSessionId = undefined;
        this._handlers = undefined;
    }

    private _autoAttach(sessionId: CDPSessionId, types: CDPTargetInfo["type"][]): Promise<void> {
        return this._cdp.target.setAutoAttach(sessionId, {
            autoAttach: true,
            waitForDebuggerOnStart: true,
            flatten: true,
            filter: [...types.map(type => ({ type })), { exclude: true }],
        });
    }

    private _onAttached = (params: TargetEvents["attachedToTarget"], parentId?: CDPSessionId): void => {
        if (!parentId || (parentId !== this._browserSessionId && !this._sessions.has(parentId))) {
            return;
        }
        if (this._sessions.has(params.sessionId)) {
            return;
        }
        const pending = this._attach(params, parentId)
            .catch(error => {
                if (this._starting) {
                    this._startError ??= error;
                } else {
                    logger.warn(`Failed to monitor network target ${params.targetInfo.targetId}: ${error}`);
                }
            })
            .finally(() => this._targetTasks.delete(pending));
        this._targetTasks.add(pending);
    };

    private async _attach(params: TargetEvents["attachedToTarget"], parentId: CDPSessionId): Promise<void> {
        const { sessionId, targetInfo, waitingForDebugger } = params;
        const parent = this._sessions.get(parentId);
        const isWorker = ["worker", "shared_worker", "service_worker"].includes(targetInfo.type);
        const accepted =
            !this._stopping &&
            (parent
                ? targetInfo.type === "iframe" || isWorker
                : (targetInfo.type === "page" || isWorker) && this._contexts.has(targetInfo.browserContextId));
        try {
            const commands: Promise<void>[] = [];
            if (accepted) {
                this._sessions.set(sessionId, {
                    parentId,
                    type: targetInfo.type,
                    requests: targetInfo.type === "iframe" ? parent!.requests : new Map(),
                    bodyReads: new Set(),
                    chains: targetInfo.type === "iframe" ? parent!.chains : new Map(),
                });
                commands.push(this._cdp.network.enable(sessionId), this._autoAttach(sessionId, ["iframe", "worker"]));
                if (!isWorker) {
                    commands.push(this._cdp.page.enable(sessionId));
                }
            }
            // Issue setup before resuming, but do not wait: a paused popup can defer command responses.
            if (waitingForDebugger) {
                commands.push(this._cdp.runtime.runIfWaitingForDebugger(sessionId));
            }
            await Promise.all(commands);
            if (!accepted || this._stopping) {
                this._removeSession(sessionId);
                await this._cdp.target.detachFromTarget(sessionId, parentId);
            }
        } catch (error) {
            // Network setup must never leave a new page or frame paused.
            if (waitingForDebugger) {
                await this._cdp.runtime.runIfWaitingForDebugger(sessionId).catch(() => {});
            }
            this._removeSession(sessionId);
            await this._cdp.target.detachFromTarget(sessionId, parentId).catch(() => {});
            throw error;
        }
    }

    private async _awaitTargetTasks(): Promise<void> {
        while (this._targetTasks.size) {
            await Promise.all(this._targetTasks);
        }
    }

    private _onDetached = ({ sessionId }: TargetEvents["detachedFromTarget"]): void => {
        const session = this._sessions.get(sessionId);
        const parentId = session?.parentId;
        if (session?.type !== "iframe" || !parentId || !this._sessions.has(parentId)) {
            this._removeSession(sessionId);
            return;
        }
        // A remote-to-local frame swap can report detachment before the parent's frameAttached event.
        const pending = this._cdp.page
            .enable(parentId)
            .catch(() => {})
            .then(() => this._removeSession(sessionId))
            .finally(() => this._targetTasks.delete(pending));
        this._targetTasks.add(pending);
    };

    private _onFrameAttached = ({ frameId }: PageEvents["frameAttached"], sessionId?: CDPSessionId): void => {
        const session = this._sessions.get(sessionId!);
        for (const request of session?.requests.values() ?? []) {
            if (request.navigationFrameId === frameId) {
                request.sessionId = sessionId!;
            }
        }
    };

    private _removeSession(sessionId: CDPSessionId): void {
        const session = this._sessions.get(sessionId);
        if (!session) {
            return;
        }
        this._sessions.delete(sessionId);
        for (const cancel of session.bodyReads) {
            cancel();
        }
        session.bodyReads.clear();
        for (const [requestId, request] of session.requests) {
            if (request.sessionId === sessionId) {
                request.finish("Network target detached before the request finished");
                session.requests.delete(requestId);
            }
        }
        for (const [childId, child] of this._sessions) {
            if (child.parentId === sessionId) {
                this._removeSession(childId);
            }
        }
    }

    private _onRequest = (params: NetworkEvents["requestWillBeSent"], sessionId?: CDPSessionId): void => {
        const session = this._sessions.get(sessionId!);
        if (!session) {
            return;
        }

        const { requestId, request, timestamp, wallTime, redirectResponse } = params;
        const previous = this._request(requestId, sessionId);
        if (redirectResponse && previous) {
            previous.expectsExtraInfo = params.redirectHasExtraInfo;
            this._emitResponse(requestId, previous, redirectResponse, timestamp, true);
            this._finish(requestId, timestamp, sessionId);
        } else if (previous) {
            return;
        }

        let finish!: TrackedRequest["finish"];
        const tracked: TrackedRequest = {
            sessionId: sessionId!,
            navigationFrameId: requestId === params.loaderId ? params.frameId : undefined,
            timestamp,
            responseBodySize: 0,
            requestHeaders: headersToArray(request.headers),
            resourceType: params.type?.toLowerCase(),
            finished: new Promise(resolve => {
                finish = resolve;
            }),
            finish: error => finish(error),
            request: {
                url: request.url,
                method: request.method,
                get headers() {
                    return tracked.requestHeaders;
                },
                get resourceType() {
                    return tracked.resourceType;
                },
                get failureDetails() {
                    return tracked.failureDetails;
                },
                timestamp: wallTime * 1000,
                consumeBody: consumeOnce(this._readRequestBody.bind(this, request, requestId, () => tracked.sessionId)),
            },
        };
        session.requests.set(requestId, tracked);
        this._chain(requestId, sessionId)!.hops.push(tracked);
        this._handlers?.onRequest(tracked.request);
    };

    private _readRequestBody(
        request: CDPNetworkRequest,
        requestId: string,
        getSessionId: () => CDPSessionId,
    ): Promise<Buffer | null> {
        return this._readBody(async () => {
            if (request.postDataEntries?.length) {
                if (request.postDataEntries.some(entry => entry.bytes === undefined)) {
                    throw new Error("Request body contains unavailable data");
                }
                this._checkBodySize(
                    request.postDataEntries.reduce(
                        (size, entry) => size + Buffer.byteLength(entry.bytes!, "base64"),
                        0,
                    ),
                );
                return Buffer.concat(request.postDataEntries.map(entry => Buffer.from(entry.bytes!, "base64")));
            }
            if (request.postData !== undefined) {
                return this._decodeBody(request.postData);
            }
            if (!request.hasPostData) {
                return null;
            }
            const sessionId = getSessionId();
            const { postData, base64Encoded } = await this._readFromSession(sessionId, () =>
                this._cdp.network.getRequestPostData(sessionId, requestId),
            );
            return this._decodeBody(postData, base64Encoded ? "base64" : "utf8");
        });
    }

    private _onResponse = (params: NetworkEvents["responseReceived"], sessionId?: CDPSessionId): void => {
        const tracked = this._request(params.requestId, sessionId);
        if (tracked && !tracked.response) {
            tracked.expectsExtraInfo = params.hasExtraInfo;
            tracked.resourceType = params.type?.toLowerCase() ?? tracked.resourceType;
            this._emitResponse(params.requestId, tracked, params.response, params.timestamp);
        }
    };

    private _onData = (params: NetworkEvents["dataReceived"], sessionId?: CDPSessionId): void => {
        const tracked = this._request(params.requestId, sessionId);
        if (tracked) {
            tracked.responseBodySize += params.dataLength;
        }
    };

    private _emitResponse(
        requestId: string,
        tracked: TrackedRequest,
        response: Pick<CDPNetworkResponse, "status" | "statusText" | "headers" | "timing">,
        timestamp?: number,
        redirect = false,
    ): void {
        tracked.responseHeaders = headersToArray(response.headers);
        tracked.response = {
            request: tracked.request,
            status: response.status,
            statusText: response.statusText,
            get headers(): NetworkHeader[] {
                return tracked.responseHeaders!;
            },
            get networkStatus(): number | undefined {
                return tracked.networkStatus;
            },
            timestamp: timestamp === undefined ? undefined : this._wallTime(tracked, timestamp),
            ...(response.timing ? { timing: this._timing(tracked, response.timing) } : {}),
            consumeBody: consumeOnce(() =>
                this._readBody(async () => {
                    if (redirect) {
                        throw new Error("Response body is unavailable for redirects");
                    }
                    const error = await tracked.finished;
                    if (error !== null) {
                        throw new Error(error);
                    }
                    this._checkBodySize(tracked.responseBodySize);
                    const result = await this._readFromSession(tracked.sessionId, () =>
                        this._cdp.network.getResponseBody(tracked.sessionId, requestId),
                    );
                    return this._decodeBody(result.body, result.base64Encoded ? "base64" : "utf8");
                }),
            ),
        };
        this._handlers?.onResponse(tracked.response);
    }

    private _chain(requestId: string, sessionId?: CDPSessionId): RequestChain | undefined {
        const session = this._sessions.get(sessionId!);
        if (!session) {
            return;
        }
        let chain = session.chains.get(requestId);
        if (!chain) {
            chain = { requestId, hops: [], requestHeaders: [], responses: [] };
            session.chains.set(requestId, chain);
            this._chains.add(chain);
        }
        return chain;
    }

    private _onRequestExtraInfo = (
        params: NetworkEvents["requestWillBeSentExtraInfo"],
        sessionId?: CDPSessionId,
    ): void => {
        this._chain(params.requestId, sessionId)?.requestHeaders.push(params);
    };

    private _onResponseExtraInfo = (
        params: NetworkEvents["responseReceivedExtraInfo"],
        sessionId?: CDPSessionId,
    ): void => {
        this._chain(params.requestId, sessionId)?.responses.push(params);
    };

    reconcile(): void {
        this._reconcile(false);
    }

    private _reconcile(final: boolean): void {
        // Both extra-info streams preserve hop order, but can precede or follow ordinary events.
        // A live read cannot assign a slot to a hop until its eligibility is known or it has failed.
        for (const chain of this._chains) {
            let index = 0;
            for (const hop of chain.hops) {
                if (hop.expectsExtraInfo === false) {
                    continue;
                }
                if (!final && hop.expectsExtraInfo === undefined && !hop.failed) {
                    break;
                }
                const request = chain.requestHeaders[index];
                const response = chain.responses[index++];
                if (request) {
                    hop.requestHeaders = headersToArray(request.headers);
                }
                if (response) {
                    if (!hop.response) {
                        this._emitResponse(chain.requestId, hop, {
                            status: response.statusCode,
                            statusText: "",
                            headers: response.headers,
                        });
                    }
                    hop.responseHeaders = headersToArray(response.headers);
                    hop.networkStatus = response.statusCode;
                }
            }
        }
    }

    private _timing(tracked: TrackedRequest, timing: CDPNetworkResourceTiming): NetworkTiming {
        // CDP uses -1 for phases that did not occur (for example, a reused connection).
        const available = (value: number): number | undefined =>
            Number.isFinite(value) && value >= 0 ? value : undefined;

        return {
            startTime: this._wallTime(tracked, timing.requestTime),
            dnsStart: available(timing.dnsStart),
            dnsEnd: available(timing.dnsEnd),
            connectStart: available(timing.connectStart),
            connectEnd: available(timing.connectEnd),
            tlsStart: available(timing.sslStart),
            tlsEnd: available(timing.sslEnd),
            sendStart: available(timing.sendStart),
            sendEnd: available(timing.sendEnd),
            responseHeadersStart: available(timing.receiveHeadersStart),
            responseHeadersEnd: available(timing.receiveHeadersEnd),
        };
    }

    private _onFinished = (params: NetworkEvents["loadingFinished"], sessionId?: CDPSessionId): void => {
        this._finish(params.requestId, params.timestamp, sessionId);
    };

    private _onFailed = (params: NetworkEvents["loadingFailed"], sessionId?: CDPSessionId): void => {
        const tracked = this._request(params.requestId, sessionId);
        if (!tracked) {
            return;
        }
        tracked.resourceType = params.type?.toLowerCase() ?? tracked.resourceType;
        if (params.blockedReason || params.corsErrorStatus) {
            tracked.failureDetails = {
                ...(params.blockedReason ? { blockedReason: params.blockedReason } : {}),
                ...(params.corsErrorStatus
                    ? {
                          corsError: params.corsErrorStatus.corsError,
                          failedParameter: params.corsErrorStatus.failedParameter,
                      }
                    : {}),
            };
        }
        this._finish(params.requestId, params.timestamp, sessionId, params.errorText);
    };

    private _request(requestId: string, sessionId?: CDPSessionId): TrackedRequest | undefined {
        const request = this._sessions.get(sessionId!)?.requests.get(requestId);
        // An iframe navigation can start and finish in different sessions when it changes processes.
        if (request?.navigationFrameId) {
            request.sessionId = sessionId!;
        }
        return request;
    }

    private _finish(requestId: string, timestamp: number, sessionId?: CDPSessionId, error?: string): void {
        const tracked = this._request(requestId, sessionId);
        if (!tracked) {
            return;
        }
        this._sessions.get(sessionId!)!.requests.delete(requestId);
        tracked.finish(error ?? null);
        const wallTime = this._wallTime(tracked, timestamp);
        if (error !== undefined) {
            tracked.failed = true;
            this._handlers?.onFailed(tracked.request, wallTime, error);
        } else {
            this._handlers?.onFinished(tracked.request, wallTime);
        }
    }

    private _wallTime(tracked: TrackedRequest, timestamp: number): number {
        return tracked.request.timestamp + (timestamp - tracked.timestamp) * 1000;
    }

    private _checkBodySize(size: number): void {
        if (size > this._maxBodySizeBytes) {
            throw new Error(`Body exceeds ${this._maxBodySizeBytes} bytes`);
        }
    }

    private _decodeBody(body: string, encoding: BufferEncoding = "utf8"): Buffer {
        this._checkBodySize(Buffer.byteLength(body, encoding));
        return Buffer.from(body, encoding);
    }

    private async _readFromSession<T>(sessionId: CDPSessionId, read: () => Promise<T>): Promise<T> {
        const session = this._sessions.get(sessionId);
        if (!session) {
            throw new Error("Network target is no longer available");
        }
        let cancel!: () => void;
        const closed = new Promise<never>((_resolve, reject) => {
            cancel = (): void => reject(new Error("Network target is no longer available"));
        });
        session.bodyReads.add(cancel);
        try {
            return await Promise.race([read(), closed]);
        } finally {
            session.bodyReads.delete(cancel);
        }
    }

    private _readBody<T extends Buffer | null>(read: () => Promise<T>): Promise<T> {
        const promise = read();
        this._bodyReads.add(promise);
        const done = (): void => {
            this._bodyReads.delete(promise);
        };
        void promise.then(done, done);
        return promise;
    }
}
