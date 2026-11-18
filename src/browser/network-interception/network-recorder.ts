import crypto from "node:crypto";
import fs from "fs-extra";
import makeDebug from "debug";
import * as temp from "../../temp";
import RuntimeConfig from "../../config/runtime-config";
import type { NetworkEventSource, NetworkRequest, NetworkResponse, NetworkSettings } from "./types";
import { CdpNetworkEventSource } from "./cdp-network-event-source";

const debug = makeDebug("testplane:time-travel:network");

interface RecordedBody {
    /** SHA-256 of the body stored at network/bodies/<hash> in the snapshot archive. */
    bodyHash?: string;
    bodyFilePath?: string;
    bodyError?: string;
}

interface RecordedResponse
    extends
        Pick<NetworkResponse, "status" | "statusText" | "headers" | "timestamp" | "timing" | "networkStatus">,
        RecordedBody {}

export interface RecordedRequest
    extends Pick<NetworkRequest, "url" | "method" | "headers" | "timestamp" | "resourceType">, RecordedBody {
    response?: RecordedResponse;
    finishedAt?: number;
    failure?: string;
    failureDetails?: NetworkRequest["failureDetails"];
}

export class NetworkRecorder implements AsyncDisposable {
    // Owned
    private _source?: NetworkEventSource;

    // Data
    private _stopPromise?: Promise<void>;
    private readonly _pending = new Set<Promise<void>>();
    private _maxBodySizeBytes = Infinity;
    private readonly _requests = new Map<NetworkRequest, { record: RecordedRequest; response?: NetworkResponse }>();
    private readonly _bodyWrites = new Map<string, Promise<string>>();

    private constructor() {}

    static async start(browser: WebdriverIO.Browser, settings: NetworkSettings): Promise<NetworkRecorder> {
        const recorder = new NetworkRecorder();

        try {
            const cdp = await browser.unstable_getCdp();
            if (!cdp) {
                debug("CDP is unavailable");
                return recorder;
            }

            const source = new CdpNetworkEventSource(cdp, browser, settings);
            recorder._maxBodySizeBytes = settings.maxBodySizeBytes;
            recorder._source = source;
            await source.start({
                onRequest: recorder._onRequest,
                onResponse: recorder._onResponse,
                onFinished: recorder._onFinished,
                onFailed: recorder._onFinished,
            });
        } catch (error) {
            debug("Network recording could not start: %O", error);
            await recorder.stop();
            return new NetworkRecorder();
        }

        return recorder;
    }

    /** Stops capture and settles pending body writes before the final snapshot. */
    stop(): Promise<void> {
        return (this._stopPromise ??= this._stop());
    }

    [Symbol.asyncDispose](): Promise<void> {
        return this.stop();
    }

    private async _stop(): Promise<void> {
        const source = this._source;
        if (!source) {
            return;
        }

        try {
            // Final reconciliation can still emit responses.
            await source.stop();
        } catch (error) {
            debug("Network recording cleanup failed: %O", error);
        } finally {
            await Promise.all(this._pending);
            this._source = undefined;
        }
    }

    snapshot(): RecordedRequest[] {
        try {
            this._source?.reconcile?.();
        } catch (error) {
            debug("Network metadata reconciliation failed: %O", error);
        }

        // Protocol metadata can be enriched after the initial request/response events.
        return [...this._requests].map(([request, { record, response }]) => {
            try {
                const result = { ...record, headers: request.headers };
                const resourceType = request.resourceType;
                if (resourceType !== undefined) {
                    result.resourceType = resourceType;
                }
                if (request.failureDetails) {
                    result.failureDetails = request.failureDetails;
                }
                if (response) {
                    const networkStatus = response.networkStatus;
                    result.response = {
                        ...record.response!,
                        headers: response.headers,
                        ...(networkStatus !== undefined ? { networkStatus } : {}),
                    };
                }
                return result;
            } catch (error) {
                debug("Could not read enriched network metadata: %O", error);
                return { ...record, response: record.response && { ...record.response } };
            }
        });
    }

    private _onRequest = (request: NetworkRequest): void => {
        const { url, method, headers, timestamp } = request;
        const record: RecordedRequest = { url, method, headers, timestamp };
        this._requests.set(request, { record });
        this._captureBody(record, () => request.consumeBody());
    };

    private _onResponse = (response: NetworkResponse): void => {
        const { request, status, statusText, headers, timestamp } = response;
        const entry = this._requests.get(request)!;
        entry.response = response;
        const { record } = entry;
        record.response = {
            status,
            statusText,
            headers,
            timestamp,
            ...(response.timing ? { timing: response.timing } : {}),
        };
        this._captureBody(record.response, () => response.consumeBody());
    };

    private _onFinished = (request: NetworkRequest, timestamp: number, error?: string): void => {
        const { record } = this._requests.get(request)!;
        record.finishedAt = timestamp;
        if (error !== undefined) {
            record.failure = error;
        }
    };

    private _captureBody(record: RecordedBody, read: () => Promise<Buffer | null>): void {
        const pending = this._saveBody(record, read).then(() => {
            this._pending.delete(pending);
        });
        this._pending.add(pending);
    }

    private async _saveBody(record: RecordedBody, read: () => Promise<Buffer | null>): Promise<void> {
        try {
            const body = await read();
            if (body === null) {
                return;
            }
            if (body.length > this._maxBodySizeBytes) {
                throw new Error(`Body exceeds ${this._maxBodySizeBytes} bytes`);
            }
            const hash = crypto.createHash("sha256").update(body).digest("hex");
            if (!this._bodyWrites.has(hash)) {
                const { tempOpts } = RuntimeConfig.getInstance();
                if (tempOpts) {
                    temp.attach(tempOpts);
                } else {
                    temp.init(undefined);
                }
                const filePath = temp.path();
                this._bodyWrites.set(
                    hash,
                    fs.writeFile(filePath, body).then(() => filePath),
                );
            }
            const filePath = await this._bodyWrites.get(hash)!;
            record.bodyHash = hash;
            record.bodyFilePath = filePath;
        } catch (error) {
            record.bodyError = error instanceof Error ? error.message : String(error);
        }
    }
}
