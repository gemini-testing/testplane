export interface NetworkSettings {
    maxBodySizeBytes: number;
}

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
    /** Lowercase resource type, when provided by the source. */
    readonly resourceType?: string;
    readonly failureDetails?: NetworkFailureDetails;
    /** Reads the body once. */
    consumeBody(): Promise<Buffer | null>;
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
    /** Reads the body once. */
    consumeBody(): Promise<Buffer>;
}

export interface NetworkEventSourceHandlers {
    onRequest(request: NetworkRequest): void;
    onResponse(response: NetworkResponse): void;
    onFinished(request: NetworkRequest, timestamp: number): void;
    onFailed(request: NetworkRequest, timestamp: number, error: string): void;
}

/** Metadata on received objects may be enriched until capture stops. */
export interface NetworkEventSource extends AsyncDisposable {
    start(handlers: NetworkEventSourceHandlers): Promise<void>;
    /** Applies any metadata that can be matched to an emitted request or response. */
    reconcile?(): void;
    /** Stops events and settles pending body reads before releasing the protocol session. */
    stop(): Promise<void>;
}
