import type { WorkerRunTestOpts, WorkerRunTestTestplaneCtx } from "../../testplane";
import type { Test } from "../../../test-reader/test-object/test";
import type { BrowserConfig } from "../../../config/browser-config";
import type { BrowserAgent } from "../browser-agent";
import type { Browser } from "../../../browser/types";
import type { ProfilerRuntimeLike } from "../../../profiler/runtime/types";

export interface WorkerTestRunnerRunOpts
    extends Pick<WorkerRunTestOpts, "sessionId" | "sessionCaps" | "sessionOpts" | "state"> {}

export interface WorkerTestRunnerCtorOpts {
    test: Test;
    file: string;
    config: BrowserConfig;
    browserAgent: BrowserAgent;
    attempt: number;
    attemptId?: string;
    profileSessionId?: string;
    profiler?: ProfilerRuntimeLike;
}

export interface ExecutionThreadCtorOpts {
    test: Test;
    browser: Browser;
    testplaneCtx: WorkerRunTestTestplaneCtx;
    hermioneCtx?: WorkerRunTestTestplaneCtx;
    attempt: number;
    attemptId?: string;
    profileSessionId?: string;
    profiler?: ProfilerRuntimeLike;
    tags?: string[];
}
