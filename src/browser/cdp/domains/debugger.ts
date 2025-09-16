import { CDPConnection } from "../connection";
import { CDPEventEmitter } from "../emitter";
import type {
    CDPDebuggerCallFrame,
    CDPDebuggerPausedReason,
    CDPExecutionContextId,
    CDPRuntimeScriptId,
    CDPRuntimeStackTrace,
    CDPSessionId,
} from "../types";

interface ScriptData {
    scriptId: CDPRuntimeScriptId;
    /** URL or name of the script parsed (if any). */
    url: string;
    /** Line offset of the script within the resource with given URL (for script tags). */
    startLine: number;
    /** Column offset of the script within the resource with given URL. */
    startColumn: number;
    /** Last line of the script. */
    endLine: number;
    /** Length of the last line of the script. */
    endColumn: number;
    executionContextId: CDPExecutionContextId;
    /** Content hash of the script, SHA-256. */
    hash: string;
    /** For Wasm modules, the content of the build_id custom section. For JavaScript the debugId magic comment. */
    buildId: string;
    /** Embedder-specific auxiliary data likely matching {isDefault: boolean, type: 'default'|'isolated'|'worker', frameId: string} */
    executionContextAuxData?: Record<string, unknown>;
    sourceMapURL?: string;
    /** True, if this script has sourceURL. */
    hasSourceURL?: boolean;
    /** True, if this script is ES6 module. */
    isModule?: boolean;
    /** This script length. */
    length?: number;
}

interface GetScriptSourceResponse {
    /** Script source (empty in case of Wasm bytecode). */
    scriptSource: string;
    /** Wasm bytecode. (Encoded as a base64 string when passed over JSON) */
    bytecode?: string;
}

export interface DebuggerEvents {
    paused: {
        callFrames: CDPDebuggerCallFrame;
        /** Location of console.profileEnd(). */
        reason: CDPDebuggerPausedReason;
        /** Object containing break-specific auxiliary properties. */
        data?: Record<string, unknown>;
        asyncStackTrace?: CDPRuntimeStackTrace;
    };
    resumed: Record<never, unknown>;
    scriptFailedToParse: ScriptData;
    scriptParsed: ScriptData;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Debugger/ */
export class CDPDebugger extends CDPEventEmitter<DebuggerEvents> {
    private readonly _connection: CDPConnection;

    public constructor(connection: CDPConnection) {
        super();

        this._connection = connection;
    }

    /** @param sessionId result of "Target.attachToTarget" */
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Debugger/#method-disable */
    async disable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Debugger.disable", { sessionId });
    }

    /** @param sessionId result of "Target.attachToTarget" */
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Debugger/#method-enable */
    async enable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Debugger.enable", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Debugger/#method-resume */
    async resume(sessionId: CDPSessionId, terminateOnResume?: boolean): Promise<void> {
        return this._connection.request("Debugger.resume", { sessionId, params: { terminateOnResume } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Debugger/#method-getScriptSource */
    async getScriptSource(sessionId: CDPSessionId, scriptId: CDPRuntimeScriptId): Promise<GetScriptSourceResponse> {
        return this._connection.request("Debugger.getScriptSource", { sessionId, params: { scriptId } });
    }
}
