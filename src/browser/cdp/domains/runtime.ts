import { CDPConnection } from "../connection";
import { CDPEventEmitter } from "../emitter";
import type { CDPExecutionContextId, CDPRuntimeRemoteObject, CDPSessionId } from "../types";

interface EvaluateRequest {
    /** Expression to evaluate. */
    expression: string;
    /** Symbolic group name that can be used to release multiple objects. */
    objectGroup?: string;
    /** Determines whether Command Line API should be available during the evaluation. */
    includeCommandLineAPI?: boolean;
    /** In silent mode exceptions thrown during evaluation are not reported and do not pause execution. Overrides setPauseOnException state. */
    silent?: boolean;
    /** Specifies in which execution context to perform evaluation. If the parameter is omitted the evaluation will be performed in the context of the inspected page. This is mutually exclusive with uniqueContextId, which offers an alternative way to identify the execution context that is more reliable in a multi-process environment. */
    contextId?: CDPExecutionContextId;
    /** Whether the result is expected to be a JSON object that should be sent by value. */
    returnByValue?: boolean;
    /** Whether execution should be treated as initiated by user in the UI. */
    userGesture?: boolean;
    /** Whether execution should await for resulting value and return once awaited promise is resolved. */
    awaitPromise?: boolean;
}

interface EvaluateResponse<T> {
    /** Evaluation result. */
    result: CDPRuntimeRemoteObject<T>;
    /** Exception details. */
    exceptionDetails?: Record<string, unknown>;
}

export interface RuntimeEvents {
    consoleAPICalled: Record<string, unknown>;
    exceptionRevoked: Record<string, unknown>;
    exceptionThrown: Record<string, unknown>;
    executionContextCreated: Record<string, unknown>;
    executionContextDestroyed: Record<string, unknown>;
    executionContextsCleared: Record<string, unknown>;
    inspectRequested: Record<string, unknown>;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Runtime/ */
export class CDPRuntime extends CDPEventEmitter<RuntimeEvents> {
    private readonly _connection: CDPConnection;

    public constructor(connection: CDPConnection) {
        super();

        this._connection = connection;
    }

    /**
     * @param sessionId result of "Target.attachToTarget"
     * @link https://chromedevtools.github.io/devtools-protocol/1-3/Runtime/#method-evaluate
     */
    async evaluate<T>(sessionId: CDPSessionId, params: EvaluateRequest): Promise<EvaluateResponse<T>> {
        return this._connection.request("Runtime.evaluate", { sessionId, params });
    }

    /**
     * @param sessionId result of "Target.attachToTarget"
     * @link https://chromedevtools.github.io/devtools-protocol/1-3/Runtime/#method-enable
     */
    async enable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Runtime.enable", { sessionId });
    }

    /**
     * @param sessionId result of "Target.attachToTarget"
     * @link https://chromedevtools.github.io/devtools-protocol/1-3/Runtime/#method-disable
     */
    async disable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Runtime.disable", { sessionId });
    }
}
