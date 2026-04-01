export type Domain = string;
export type MethodName = string;
export type SessionId = string;
export type Suffix = string;
export type CDPRequestId = number;
export type CDPTargetId = string;
export type CDPSessionId = string;
export type CDPBrowserContextId = string;
export type CDPRuntimeScriptId = string;
export type CDPCallFrameId = string;
export type CDPExecutionContextId = number;
export type CDPStyleSheetId = string;
export type CDPFrameId = string;
export type CDPDOMBackendNodeId = number;
export type CDPStyleSheetOrigin = "injected" | "user-agent" | "inspector" | "regular";
export type CDPDebuggerPausedReason =
    | "ambiguous"
    | "assert"
    | "CSPViolation"
    | "debugCommand"
    | "DOM"
    | "EventListener"
    | "exception"
    | "instrumentation"
    | "OOM"
    | "other"
    | "promiseRejection"
    | "XHR"
    | "step";

// https://source.chromium.org/chromium/chromium/src/+/main:content/browser/devtools/devtools_agent_host_impl.cc;l=131-144?q=f:devtools%20-f:out%20%22::kTypeTab%5B%5D%22&ss=chromium
type TargetType =
    | "tab"
    | "page"
    | "iframe"
    | "worker"
    | "shared_worker"
    | "service_worker"
    | "worklet"
    | "shared_storage_worklet"
    | "browser"
    | "webview"
    | "other"
    | "auction_worklet"
    | "assistive_technology";

export interface CDPRequest<T extends { [key in keyof T]: unknown } = Record<never, never>> {
    id: CDPRequestId;
    sessionId?: CDPSessionId;
    method: `${Domain}.${MethodName}`;
    params?: T;
}

export interface CDPErrorResponse {
    id: CDPRequestId;
    error: {
        code: number;
        message: string;
    };
}

export interface CDPSuccessResponse<T = Record<string, unknown>> {
    id: CDPRequestId;
    result: T;
}

export interface CDPEvent<T = Record<string, unknown>> {
    method: `${Domain}.${MethodName}`;
    params: T;
    sessionId?: CDPSessionId;
}

export type CDPResponse<T = Record<string, unknown>> = CDPErrorResponse | CDPSuccessResponse<T>;

export type CDPMessage = CDPResponse | CDPEvent;

export interface CDPTargetInfo {
    targetId: CDPTargetId;
    type: TargetType;
    title: string;
    url: string;
    /** Whether the target has an attached client. */
    attached: boolean;
    /** Opener target Id */
    openerId?: CDPTargetId;
}

interface CoverageRange {
    /** JavaScript script source offset for the range start. */
    startOffset: number;
    /** JavaScript script source offset for the range end. */
    endOffset: number;
    /** Collected execution count of the source range. */
    count: number;
}

interface FunctionCoverage {
    /** JavaScript function name. */
    functionName: string;
    /** Source ranges inside the function with coverage data. */
    ranges: CoverageRange[];
    /** Whether coverage data for this function has block granularity. */
    isBlockCoverage: boolean;
}

export interface CDPScriptCoverage {
    /** JavaScript script id. */
    scriptId: CDPRuntimeScriptId;
    /** JavaScript script name or url. */
    url: string;
    /** Functions contained in the script that has coverage data. */
    functions: FunctionCoverage[];
}

export interface CDPDebuggerLocation {
    /** Script identifier as reported in the Debugger.scriptParsed. */
    scriptId: CDPRuntimeScriptId;
    /** Line number in the script (0-based). */
    lineNumber: number;
    /** Column number in the script (0-based). */
    columnNumber?: number;
}

interface RuntimeCallFrame {
    /** JavaScript function name. */
    functionName: string;
    /** JavaScript script id. */
    scriptId: CDPRuntimeScriptId;
    /** JavaScript script name or url. */
    url: string;
    /** JavaScript script line number (0-based). */
    lineNumber: number;
    /** JavaScript script column number (0-based). */
    columnNumber: number;
}

interface PositionTickInfo {
    /** Source line number (1-based). */
    line: number;
    /** Number of samples attributed to the source line. */
    ticks: number;
}

interface ProfileNode {
    /** Unique id of the node. */
    id: number;
    /** Function location. */
    callFrame: RuntimeCallFrame;
    /** Number of samples where this node was on top of the call stack. */
    hitCount?: number;
    /** Child node ids. */
    children?: number[];
    /** The reason of being not optimized. The function may be deoptimized or marked as don't optimize. */
    deoptReason?: string;
    /** An array of source position ticks. */
    positionTicks?: PositionTickInfo[];
}

export interface CDPProfile {
    /** The list of profile nodes. First item is the root node. */
    nodes: ProfileNode[];
    /** Profiling start timestamp in microseconds. */
    startTime: number;
    /** Profiling end timestamp in microseconds. */
    endTime: number;
    /** Ids of samples top nodes. */
    samples?: number[];
    /** Time intervals between adjacent samples in microseconds.
     *  The first delta is relative to the profile startTime.
     */
    timeDeltas: number[];
}

interface DebuggerLocation {
    scriptId: CDPRuntimeScriptId;
    /** Line number in the script (0-based). */
    lineNumber: number;
    /** Column number in the script (0-based). */
    columnNumber?: number;
}

export interface CDPDebuggerCallFrame {
    callFrameId: CDPCallFrameId;
    functionName: string;
    functionLocation?: DebuggerLocation;
    location: DebuggerLocation;
}

export interface CDPRuntimeStackTrace {
    description?: string;
    callFrames: CDPDebuggerCallFrame;
    parent?: CDPRuntimeStackTrace;
}

export interface CDPRuntimeRemoteObject<T = undefined> {
    /** Object type. */
    type: "object" | "function" | "undefined" | "string" | "number" | "boolean" | "symbol" | "bigint";
    /** Object subtype hint. Specified for object type values only. */
    subtype?: string;
    /** Object class (constructor) name. Specified for object type values only. */
    className?: string;
    /** Remote object value in case of primitive values or JSON values (if it was requested). */
    value: T;
    /** Primitive value which can not be JSON-stringified does not have value, but gets this property. */
    unserializableValue?: string;
    /** String representation of the object. */
    description?: string;
}

export interface CDPCSSStyleSheetHeader {
    /** The stylesheet identifier. */
    styleSheetId: CDPStyleSheetId;
    /** Owner frame identifier. */
    frameId: CDPFrameId;
    /** Stylesheet resource URL. Empty if this is a constructed stylesheet created using new CSSStyleSheet() (but non-empty if this is a constructed stylesheet imported as a CSS module script). */
    sourceURL: string;
    /** URL of source map associated with the stylesheet (if any). */
    sourceMapURL?: string;
    /** Stylesheet origin. */
    origin: CDPStyleSheetOrigin;
    /** Stylesheet title. */
    title: string;
    /** The backend id for the owner node of the stylesheet. */
    ownerNode?: CDPDOMBackendNodeId;
    /** Denotes whether the stylesheet is disabled. */
    disabled: boolean;
    /** Whether the sourceURL field value comes from the sourceURL comment. */
    hasSourceURL?: boolean;
    /** Whether this stylesheet is created for STYLE tag by parser. This flag is not set for document.written STYLE tags. */
    isInline: boolean;
    /**
     * Whether this stylesheet is mutable. Inline stylesheets become mutable after they have been modified via CSSOM API.
     * <link> element's stylesheets become mutable only if DevTools modifies them.
     * Constructed stylesheets (new CSSStyleSheet()) are mutable immediately after creation.
     */
    isMutable: boolean;
    /** True if this stylesheet is created through new CSSStyleSheet() or imported as a CSS module script. */
    isConstructed: boolean;
    /** Line offset of the stylesheet within the resource (zero based). */
    startLine: number;
    /** Column offset of the stylesheet within the resource (zero based). */
    startColumn: number;
    /** Size of the content (in characters). */
    length: number;
    /** Line offset of the end of the stylesheet within the resource (zero based). */
    endLine: number;
    /** Column offset of the end of the stylesheet within the resource (zero based). */
    endColumn: number;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-RequestId */
export type CDPNetworkRequestId = string;

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-LoaderId */
export type CDPNetworkLoaderId = string;

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-TimeSinceEpoch */
export type CDPNetworkTimeSinceEpoch = number;

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-MonotonicTime */
export type CDPNetworkMonotonicTime = number;

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-Headers */
export type CDPNetworkHeaders = Record<string, string>;

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-ResourcePriority */
export type CDPNetworkResourcePriority = "VeryLow" | "Low" | "Medium" | "High" | "VeryHigh";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-ErrorReason */
export type CDPNetworkErrorReason =
    | "Failed"
    | "Aborted"
    | "TimedOut"
    | "AccessDenied"
    | "ConnectionClosed"
    | "ConnectionReset"
    | "ConnectionRefused"
    | "ConnectionAborted"
    | "ConnectionFailed"
    | "NameNotResolved"
    | "InternetDisconnected"
    | "AddressUnreachable"
    | "BlockedByClient"
    | "BlockedByResponse";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-ResourceType */
export type CDPNetworkResourceType =
    | "Document"
    | "Stylesheet"
    | "Image"
    | "Media"
    | "Font"
    | "Script"
    | "TextTrack"
    | "XHR"
    | "Fetch"
    | "Prefetch"
    | "EventSource"
    | "WebSocket"
    | "Manifest"
    | "SignedExchange"
    | "Ping"
    | "CSPViolationReport"
    | "Preflight"
    | "Other";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-ConnectionType */
export type CDPNetworkConnectionType =
    | "none"
    | "cellular2g"
    | "cellular3g"
    | "cellular4g"
    | "bluetooth"
    | "ethernet"
    | "wifi"
    | "wimax"
    | "other";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-CookieSameSite */
export type CDPNetworkCookieSameSite = "Strict" | "Lax" | "None";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-CookiePriority */
export type CDPNetworkCookiePriority = "Low" | "Medium" | "High";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-CookieSourceScheme */
export type CDPNetworkCookieSourceScheme = "Unset" | "NonSecure" | "Secure";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-ResourceTiming */
export interface CDPNetworkResourceTiming {
    /** Timing's requestTime is a baseline in seconds, while the other numbers are ticks in milliseconds relatively to this requestTime. */
    requestTime: number;
    /** Started resolving proxy. */
    proxyStart: number;
    /** Finished resolving proxy. */
    proxyEnd: number;
    /** Started DNS address resolve. */
    dnsStart: number;
    /** Finished DNS address resolve. */
    dnsEnd: number;
    /** Started connecting to the remote host. */
    connectStart: number;
    /** Connected to the remote host. */
    connectEnd: number;
    /** Started SSL handshake. */
    sslStart: number;
    /** Finished SSL handshake. */
    sslEnd: number;
    /** Started sending request. */
    sendStart: number;
    /** Finished sending request. */
    sendEnd: number;
    /** Time the server started pushing request. */
    pushStart: number;
    /** Time the server finished pushing request. */
    pushEnd: number;
    /** Started receiving response headers. */
    receiveHeadersStart: number;
    /** Finished receiving response headers. */
    receiveHeadersEnd: number;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-Request */
export interface CDPNetworkRequest {
    /** Request URL (without fragment). */
    url: string;
    /** Fragment of the requested URL starting with hash, if present. */
    urlFragment?: string;
    /** HTTP request method. */
    method: string;
    /** HTTP request headers. */
    headers: CDPNetworkHeaders;
    /** HTTP POST request data. */
    postData?: string;
    /** True when the request has POST data. */
    hasPostData?: boolean;
    /** The mixed content type of the request. */
    mixedContentType?: "blockable" | "optionally-blockable" | "none";
    /** Priority of the resource request at the time request is sent. */
    initialPriority: CDPNetworkResourcePriority;
    /** The referrer policy of the request, as defined in https://www.w3.org/TR/referrer-policy/ */
    referrerPolicy: string;
    /** Whether is loaded via link preload. */
    isLinkPreload?: boolean;
    /** Whether the request is same-site. */
    isSameSite?: boolean;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-Response */
export interface CDPNetworkResponse {
    /** Response URL. This URL can be different from CachedResource.url in case of redirect. */
    url: string;
    /** HTTP response status code. */
    status: number;
    /** HTTP response status text. */
    statusText: string;
    /** HTTP response headers. */
    headers: CDPNetworkHeaders;
    /** Resource mimeType as determined by the browser. */
    mimeType: string;
    /** Refined HTTP request headers that were actually transmitted over the network. */
    requestHeaders?: CDPNetworkHeaders;
    /** Specifies whether physical connection was actually reused for this request. */
    connectionReused: boolean;
    /** Physical connection id that was actually used for this request. */
    connectionId: number;
    /** Remote IP address. */
    remoteIPAddress?: string;
    /** Remote port. */
    remotePort?: number;
    /** Specifies that the request was served from the disk cache. */
    fromDiskCache?: boolean;
    /** Specifies that the request was served from the ServiceWorker. */
    fromServiceWorker?: boolean;
    /** Specifies that the request was served from the prefetch cache. */
    fromPrefetchCache?: boolean;
    /** Total number of bytes received for this request so far. */
    encodedDataLength: number;
    /** Timing information for the given request. */
    timing?: CDPNetworkResourceTiming;
    /** Protocol used to fetch this request. */
    protocol?: string;
    /** Security state of the request resource. */
    securityState: "unknown" | "neutral" | "insecure" | "secure" | "info" | "insecure-broken";
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-WebSocketRequest */
export interface CDPNetworkWebSocketRequest {
    /** HTTP request headers. */
    headers: CDPNetworkHeaders;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-WebSocketResponse */
export interface CDPNetworkWebSocketResponse {
    /** HTTP response status code. */
    status: number;
    /** HTTP response status text. */
    statusText: string;
    /** HTTP response headers. */
    headers: CDPNetworkHeaders;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-WebSocketFrame */
export interface CDPNetworkWebSocketFrame {
    /** WebSocket message opcode. */
    opcode: number;
    /** WebSocket message mask. */
    mask: boolean;
    /** WebSocket message payload data. If the opcode is 1, this is a text message and payloadData is a UTF-8 string. If the opcode isn't 1, then payloadData is a base64 encoded string representing binary data. */
    payloadData: string;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-Initiator */
export interface CDPNetworkInitiator {
    /** Type of this initiator. */
    type: "parser" | "script" | "preload" | "SignedExchange" | "preflight" | "other";
    /** Initiator URL, set for Parser type or for Script type (when script is importing module) or for SignedExchange type. */
    url?: string;
    /** Initiator line number, set for Parser type or for Script type (when script is importing module) (0-based). */
    lineNumber?: number;
    /** Initiator column number, set for Parser type or for Script type (when script is importing module) (0-based). */
    columnNumber?: number;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-Cookie */
export interface CDPNetworkCookie {
    /** Cookie name. */
    name: string;
    /** Cookie value. */
    value: string;
    /** Cookie domain. */
    domain: string;
    /** Cookie path. */
    path: string;
    /** Cookie expiration date as the number of seconds since the UNIX epoch. */
    expires: number;
    /** Cookie size. */
    size: number;
    /** True if cookie is http-only. */
    httpOnly: boolean;
    /** True if cookie is secure. */
    secure: boolean;
    /** True in case of session cookie. */
    session: boolean;
    /** Cookie SameSite type. */
    sameSite?: CDPNetworkCookieSameSite;
    /** Cookie Priority. */
    priority: CDPNetworkCookiePriority;
    /** True if cookie is SameParty. */
    sameParty: boolean;
    /** Cookie source scheme type. */
    sourceScheme: CDPNetworkCookieSourceScheme;
    /** Cookie source port. Valid values are {-1, [1, 65535]}, -1 indicates an unspecified port. */
    sourcePort: number;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#type-CookieParam */
export interface CDPNetworkCookieParam {
    /** Cookie name. */
    name: string;
    /** Cookie value. */
    value: string;
    /** The request-URI to associate with the setting of the cookie. This value can affect the default domain, path, source port, and source scheme values of the created cookie. */
    url?: string;
    /** Cookie domain. */
    domain?: string;
    /** Cookie path. */
    path?: string;
    /** True if cookie is secure. */
    secure?: boolean;
    /** True if cookie is http-only. */
    httpOnly?: boolean;
    /** Cookie SameSite type. */
    sameSite?: CDPNetworkCookieSameSite;
    /** Cookie expiration date, session cookie if not set. */
    expires?: CDPNetworkTimeSinceEpoch;
    /** Cookie Priority. */
    priority?: CDPNetworkCookiePriority;
    /** True if cookie is SameParty. */
    sameParty?: boolean;
    /** Cookie source scheme type. */
    sourceScheme?: CDPNetworkCookieSourceScheme;
    /** Cookie source port. Valid values are {-1, [1, 65535]}, -1 indicates an unspecified port. */
    sourcePort?: number;
}
