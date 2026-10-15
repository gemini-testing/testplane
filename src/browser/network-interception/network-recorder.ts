import crypto from "node:crypto";
import fs from "fs-extra";
import * as temp from "../../temp";
import * as logger from "../../utils/logger";
import RuntimeConfig from "../../config/runtime-config";
import type { TimeTravelConfig } from "../../config/types";
import type { NetworkMonitor, NetworkRequest, NetworkResponse } from "./types";
import { shouldRecordSnapshots } from "../history/utils";
import { CdpNetworkMonitor } from "./cdp-network-monitor";

const warnedSessions = new Set<string>();

interface RecordedBody {
    /** SHA-256 of the body stored at network/bodies/<hash> in the snapshot archive. */
    bodyHash?: string;
    bodyFilePath?: string;
    bodyError?: string;
}

interface RecordedResponse
    extends Pick<NetworkResponse, "status" | "statusText" | "headers" | "timestamp">,
        RecordedBody {}

export interface RecordedRequest
    extends Pick<NetworkRequest, "url" | "method" | "headers" | "timestamp">,
        RecordedBody {
    response?: RecordedResponse;
    finishedAt?: number;
    failure?: string;
}

export class NetworkRecorder {
    private readonly _monitor: NetworkMonitor;
    private readonly _maxBodySizeBytes: number;
    private readonly _recordedRequests: RecordedRequest[] = [];
    private readonly _requests = new WeakMap<NetworkRequest, RecordedRequest>();
    private readonly _bodyWrites = new Map<string, Promise<string>>();
    private readonly _pending = new Set<Promise<void>>();

    constructor(monitor: NetworkMonitor, maxBodySizeBytes: number) {
        this._monitor = monitor;
        this._maxBodySizeBytes = maxBodySizeBytes;

        monitor.on("request", this._onRequest);
        monitor.on("response", this._onResponse);
        monitor.on("requestfinished", this._onFinished);
        monitor.on("requestfailed", this._onFinished);
    }

    async stop(): Promise<RecordedRequest[]> {
        this._monitor.off("request", this._onRequest);
        this._monitor.off("response", this._onResponse);
        this._monitor.off("requestfinished", this._onFinished);
        this._monitor.off("requestfailed", this._onFinished);

        await Promise.all(this._pending);

        return this._recordedRequests;
    }

    private _onRequest = (request: NetworkRequest): void => {
        const { url, method, headers, timestamp } = request;
        const record: RecordedRequest = { url, method, headers, timestamp };
        this._requests.set(request, record);
        this._recordedRequests.push(record);
        this._captureBody(record, () => request.body());
    };

    private _onResponse = (response: NetworkResponse): void => {
        const { request, status, statusText, headers, timestamp } = response;
        const record = this._requests.get(request)!;
        record.response = { status, statusText, headers, timestamp };
        this._captureBody(record.response, () => response.body());
    };

    private _onFinished = (request: NetworkRequest, timestamp: number, error?: string): void => {
        const record = this._requests.get(request)!;
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
                temp.attach(RuntimeConfig.getInstance().tempOpts);
                const filePath = temp.path();
                this._bodyWrites.set(
                    hash,
                    fs.writeFile(filePath, body).then(() => filePath),
                );
            }
            record.bodyHash = hash;
            record.bodyFilePath = await this._bodyWrites.get(hash)!;
        } catch (error) {
            record.bodyError = error instanceof Error ? error.message : String(error);
        }
    }
}

export const startNetworkRecording = async (
    session: WebdriverIO.Browser,
    config: TimeTravelConfig,
    isRetry: boolean,
): Promise<Pick<NetworkRecorder, "stop"> | null> => {
    if (!config.network.enabled || !shouldRecordSnapshots(config.mode, isRetry)) {
        return null;
    }

    let stop: NetworkRecorder["stop"] | undefined;
    try {
        const cdp = await session.unstable_getCdp();
        if (!cdp) {
            throw new Error("CDP is unavailable");
        }
        const monitor = new CdpNetworkMonitor(cdp, session, config.network.maxBodySizeBytes);

        const recorder = new NetworkRecorder(monitor, config.network.maxBodySizeBytes);
        stop = async (): Promise<RecordedRequest[]> => {
            try {
                await monitor.stop();
            } catch (error) {
                logger.warn(`Failed to stop Time Travel network recording: ${error}`);
            }
            return recorder.stop();
        };
        await monitor.start();

        return { stop };
    } catch (error) {
        await stop?.();
        if (!warnedSessions.has(session.sessionId)) {
            warnedSessions.add(session.sessionId);
            logger.warn(`Time Travel network recording is unavailable for session ${session.sessionId}: ${error}`);
        }

        return null;
    }
};
