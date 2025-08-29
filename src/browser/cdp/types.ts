export type Domain = string;
export type MethodName = string;
export type SessionId = string;
export type Suffix = string;
export type CDPRequestId = number;
export type CDPTargetId = string;
export type CDPSessionId = string;
export type CDPBrowserContextId = string;
export type RuntimeScriptId = string;

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
    scriptId: RuntimeScriptId;
    /** JavaScript script name or url. */
    url: string;
    /** Functions contained in the script that has coverage data. */
    functions: FunctionCoverage[];
}

export interface CDPDebuggerLocation {
    /** Script identifier as reported in the Debugger.scriptParsed. */
    scriptId: RuntimeScriptId;
    /** Line number in the script (0-based). */
    lineNumber: number;
    /** Column number in the script (0-based). */
    columnNumber?: number;
}

interface RuntimeCallFrame {
    /** JavaScript function name. */
    functionName: string;
    /** JavaScript script id. */
    scriptId: RuntimeScriptId;
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
