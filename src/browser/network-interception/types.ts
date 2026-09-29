import type { EventEmitter } from "node:events";

export interface NetworkHeader {
    readonly name: string;
    readonly value: string;
}

export interface NetworkRequest {
    readonly url: string;
    readonly method: string;
    readonly headers: readonly NetworkHeader[];
    readonly timestamp: number;
    body(): Promise<Buffer | null>;
}

export interface NetworkResponse {
    readonly request: NetworkRequest;
    readonly status: number;
    readonly statusText: string;
    readonly headers: readonly NetworkHeader[];
    readonly timestamp: number;
    body(): Promise<Buffer>;
}

export interface NetworkMonitorEvents {
    request: [request: NetworkRequest];
    response: [response: NetworkResponse];
    requestfinished: [request: NetworkRequest, timestamp: number];
    requestfailed: [request: NetworkRequest, timestamp: number, error: string];
}

export interface NetworkMonitor extends Pick<EventEmitter<NetworkMonitorEvents>, "on" | "off"> {
    start(): Promise<void>;
    /** Stops events and settles pending body reads before releasing the protocol session. */
    stop(): Promise<void>;
}
