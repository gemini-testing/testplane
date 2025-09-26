import { CDPConnection } from "./connection";
import { CDPEventEmitter } from "./emitter";
import type { CDPDebuggerLocation, CDPSessionId, CDPScriptCoverage, CDPProfile } from "./types";

interface StartPreciseCoverageRequest {
    /** Collect accurate call counts beyond simple 'covered' or 'not covered'. */
    callCount: boolean;
    /** Collect block-based coverage. */
    detailed: boolean;
    /** Allow the backend to send updates on its own initiative */
    allowTriggeredUpdates: boolean;
}

interface StartPreciseCoverageResponse {
    /** Monotonically increasing time (in seconds) when the coverage update was taken in the backend. */
    timestamp: number;
}

interface TakePreciseCoverageResponse {
    /** Coverage data for the current isolate */
    result: CDPScriptCoverage[];
    /** Monotonically increasing time (in seconds) when the coverage update was taken in the backend. */
    timestamp: number;
}

export interface ProfilerEvents {
    consoleProfileFinished: {
        id: string;
        /** Location of console.profileEnd(). */
        location: CDPDebuggerLocation;
        profile: CDPProfile;
        /** Profile title passed as an argument to console.profile(). */
        title?: string;
    };
    consoleProfileStarted: {
        id: string;
        /** Location of console.profile(). */
        location: CDPDebuggerLocation;
        /** Profile title passed as an argument to console.profile(). */
        title?: string;
    };
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Profiler/ */
export class CDPProfiler extends CDPEventEmitter<ProfilerEvents> {
    private readonly _connection: CDPConnection;

    public constructor(connection: CDPConnection) {
        super();

        this._connection = connection;
    }

    /** @param sessionId result of "Target.attachToTarget" */
    async disable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Profiler.disable", { sessionId });
    }

    /** @param sessionId result of "Target.attachToTarget" */
    async enable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Profiler.enable", { sessionId });
    }

    async startPreciseCoverage(sessionId: CDPSessionId, params: StartPreciseCoverageRequest): Promise<number> {
        const res = await this._connection.request<StartPreciseCoverageResponse>("Profiler.startPreciseCoverage", {
            sessionId,
            params,
        });

        return res.timestamp;
    }

    async stopPreciseCoverage(sessionId: CDPSessionId): Promise<number> {
        return this._connection.request("Profiler.stopPreciseCoverage", { sessionId });
    }

    async takePreciseCoverage(sessionId: CDPSessionId): Promise<TakePreciseCoverageResponse> {
        return this._connection.request("Profiler.takePreciseCoverage", { sessionId });
    }
}
