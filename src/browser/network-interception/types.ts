import type { EventEmitter } from "node:events";

export interface NetworkHeader {
    readonly name: string;
    readonly value: string;
}

export interface NetworkFailureDetails {
    readonly blockedReason?: string;
    readonly corsError?: string;
    readonly failedParameter?: string;
}

export interface NetworkRequest {
    readonly url: string;
    readonly method: string;
    readonly headers: readonly NetworkHeader[];
    readonly timestamp: number;
    readonly failureDetails?: NetworkFailureDetails;
    body(): Promise<Buffer | null>;
}

/** Timing offsets are milliseconds relative to startTime; absent phases are unavailable. */
export interface NetworkTiming {
    /** Baseline timestamp in milliseconds since the Unix epoch. */
    readonly startTime: number;
    readonly dnsStart?: number;
    readonly dnsEnd?: number;
    /** Connection establishment includes TLS when applicable. */
    readonly connectStart?: number;
    readonly connectEnd?: number;
    readonly tlsStart?: number;
    readonly tlsEnd?: number;
    readonly sendStart?: number;
    readonly sendEnd?: number;
    readonly responseHeadersStart?: number;
    readonly responseHeadersEnd?: number;
}

export interface NetworkResponse {
    readonly request: NetworkRequest;
    readonly status: number;
    readonly statusText: string;
    readonly headers: readonly NetworkHeader[];
    /** Unavailable when only network-stack response metadata was received. */
    readonly timestamp?: number;
    /** Actual network status, which may differ from status after cache revalidation. */
    readonly networkStatus?: number;
    readonly timing?: NetworkTiming;
    body(): Promise<Buffer>;
}

export interface NetworkMonitorEvents {
    request: [request: NetworkRequest];
    response: [response: NetworkResponse];
    requestfinished: [request: NetworkRequest, timestamp: number];
    requestfailed: [request: NetworkRequest, timestamp: number, error: string];
}

/** Metadata on emitted objects may be enriched until stop() completes. */
export interface NetworkMonitor extends Pick<EventEmitter<NetworkMonitorEvents>, "on" | "off"> {
    start(): Promise<void>;
    /** Stops events and settles pending body reads before releasing the protocol session. */
    stop(): Promise<void>;
}
