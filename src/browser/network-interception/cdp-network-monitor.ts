import { EventEmitter } from "node:events";
import type { CDP } from "../cdp";
import type { NetworkEvents } from "../cdp/domains/network";
import type { PageEvents } from "../cdp/domains/page";
import type { TargetEvents } from "../cdp/domains/target";
import type {
    CDPBrowserContextId,
    CDPFrameId,
    CDPNetworkHeaders,
    CDPNetworkResponse,
    CDPSessionId,
} from "../cdp/types";
import type { NetworkHeader, NetworkMonitor, NetworkMonitorEvents, NetworkRequest } from "./types";
import * as logger from "../../utils/logger";

interface TrackedRequest {
    request: NetworkRequest;
    timestamp: number;
    finished: Promise<string | null>;
    finish: (error: string | null) => void;
    redirected?: boolean;
    sessionId: CDPSessionId;
    navigationFrameId?: CDPFrameId;
    responded?: boolean;
    responseBodySize: number;
}

interface TargetSession {
    parentId: CDPSessionId;
    requests: Map<string, TrackedRequest>;
    bodyReads: Set<() => void>;
}

const headersToArray = (headers: CDPNetworkHeaders): NetworkHeader[] =>
    Object.entries(headers).flatMap(([name, value]) =>
        String(value)
            .split("\n")
            .map(value => ({ name: name.toLowerCase(), value })),
    );

export class CdpNetworkMonitor extends EventEmitter<NetworkMonitorEvents> implements NetworkMonitor {
    private readonly _cdp: CDP;
    private readonly _session: WebdriverIO.Browser;
    private readonly _maxBodySizeBytes: number;
    private readonly _sessions = new Map<CDPSessionId, TargetSession>();
    private readonly _contexts = new Set<CDPBrowserContextId | undefined>();
    private readonly _targetTasks = new Set<Promise<void>>();
    private readonly _bodyReads = new Set<Promise<Buffer | null>>();
    private _browserSessionId?: CDPSessionId;
    private _starting = false;
    private _startError?: unknown;
    private _stopping = false;
    private _stopPromise?: Promise<void>;

    constructor(cdp: CDP, session: WebdriverIO.Browser, maxBodySizeBytes = Infinity) {
        super();
        this._cdp = cdp;
        this._session = session;
        this._maxBodySizeBytes = maxBodySizeBytes;
    }

    async start(): Promise<void> {
        if (this._browserSessionId) {
            return;
        }

        const handles = await this._session.getWindowHandles();
        const { targetInfos } = await this._cdp.target.getTargets();
        const pages = targetInfos.filter(
            ({ targetId, type }) =>
                type === "page" && handles.some(handle => handle === targetId || handle === `CDwindow-${targetId}`),
        );
        if (!pages.length) {
            throw new Error(`Could not find CDP targets for windows ${handles.join(", ")}`);
        }

        this._contexts.clear();
        for (const page of pages) {
            this._contexts.add(page.browserContextId);
        }
        this._starting = true;
        this._startError = undefined;
        this._stopping = false;
        this._stopPromise = undefined;
        this._browserSessionId = (await this._cdp.target.attachToBrowserTarget()).sessionId;
        this._cdp.target.on("attachedToTarget", this._onAttached);
        this._cdp.target.on("detachedFromTarget", this._onDetached);
        this._cdp.page.on("frameAttached", this._onFrameAttached);
        this._cdp.network.on("requestWillBeSent", this._onRequest);
        this._cdp.network.on("responseReceived", this._onResponse);
        this._cdp.network.on("dataReceived", this._onData);
        this._cdp.network.on("loadingFinished", this._onFinished);
        this._cdp.network.on("loadingFailed", this._onFailed);

        try {
            await this._autoAttach(this._browserSessionId, "page");
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

    private async _stop(): Promise<void> {
        const browserSessionId = this._browserSessionId;
        if (!browserSessionId) {
            return;
        }

        this._stopping = true;
        await this._awaitTargetTasks();
        // Give already queued renderer events a chance to arrive before the recording cutoff.
        await Promise.all(
            [...this._sessions.keys()].map(sessionId =>
                this._cdp.runtime.evaluate(sessionId, { expression: "void 0" }).catch(() => {}),
            ),
        );
        this._cdp.network.off("requestWillBeSent", this._onRequest);
        this._cdp.network.off("responseReceived", this._onResponse);
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
    }

    private _autoAttach(sessionId: CDPSessionId, type: "page" | "iframe"): Promise<void> {
        return this._cdp.target.setAutoAttach(sessionId, {
            autoAttach: true,
            waitForDebuggerOnStart: true,
            flatten: true,
            filter: [{ type }, { exclude: true }],
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
        const accepted =
            !this._stopping &&
            (parent
                ? targetInfo.type === "iframe"
                : targetInfo.type === "page" && this._contexts.has(targetInfo.browserContextId));
        try {
            const commands: Promise<void>[] = [];
            if (accepted) {
                this._sessions.set(sessionId, {
                    parentId,
                    requests: parent?.requests ?? new Map(),
                    bodyReads: new Set(),
                });
                commands.push(
                    this._cdp.network.enable(sessionId),
                    this._cdp.page.enable(sessionId),
                    this._autoAttach(sessionId, "iframe"),
                );
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
        const parentId = this._sessions.get(sessionId)?.parentId;
        if (!parentId || !this._sessions.has(parentId)) {
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
            previous.redirected = true;
            this._emitResponse(requestId, previous, redirectResponse, timestamp, true);
            this._finish(requestId, timestamp, sessionId);
        } else if (previous) {
            return;
        }

        let finish!: TrackedRequest["finish"];
        let body: Promise<Buffer | null> | undefined;
        const tracked: TrackedRequest = {
            sessionId: sessionId!,
            navigationFrameId: requestId === params.loaderId ? params.frameId : undefined,
            timestamp,
            responseBodySize: 0,
            finished: new Promise(resolve => {
                finish = resolve;
            }),
            finish: error => finish(error),
            request: {
                url: request.url,
                method: request.method,
                headers: headersToArray(request.headers),
                timestamp: wallTime * 1000,
                body: () =>
                    (body ??= this._readBody(async () => {
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
                            return Buffer.concat(
                                request.postDataEntries.map(entry => Buffer.from(entry.bytes!, "base64")),
                            );
                        }
                        if (request.postData !== undefined) {
                            return this._decodeBody(request.postData);
                        }
                        if (!request.hasPostData) {
                            return null;
                        }
                        if (tracked.redirected || !this._sessions.has(tracked.sessionId)) {
                            throw new Error("Request body is no longer available");
                        }
                        const { postData } = await this._readFromSession(tracked.sessionId, () =>
                            this._cdp.network.getRequestPostData(tracked.sessionId, requestId),
                        );
                        return this._decodeBody(postData);
                    })),
            },
        };
        session.requests.set(requestId, tracked);
        this.emit("request", tracked.request);
    };

    private _onResponse = (params: NetworkEvents["responseReceived"], sessionId?: CDPSessionId): void => {
        const tracked = this._request(params.requestId, sessionId);
        if (tracked && !tracked.responded) {
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
        response: CDPNetworkResponse,
        timestamp: number,
        redirect = false,
    ): void {
        tracked.responded = true;
        let body: Promise<Buffer> | undefined;
        this.emit("response", {
            request: tracked.request,
            status: response.status,
            statusText: response.statusText,
            headers: headersToArray(response.headers),
            timestamp: this._wallTime(tracked, timestamp),
            body: () =>
                (body ??= this._readBody(async () => {
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
                })),
        });
    }

    private _onFinished = (params: NetworkEvents["loadingFinished"], sessionId?: CDPSessionId): void => {
        this._finish(params.requestId, params.timestamp, sessionId);
    };

    private _onFailed = (params: NetworkEvents["loadingFailed"], sessionId?: CDPSessionId): void => {
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
            this.emit("requestfailed", tracked.request, wallTime, error);
        } else {
            this.emit("requestfinished", tracked.request, wallTime);
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
