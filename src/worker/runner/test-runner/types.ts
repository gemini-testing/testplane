import type { WorkerRunTestOpts, WorkerRunTestTestplaneCtx } from "../../testplane";
import type { Test } from "../../../test-reader/test-object/test";
import type { BrowserConfig } from "../../../config/browser-config";
import type BrowserAgent from "../browser-agent";
import type { Browser } from "../../../browser/types";
import type OneTimeScreenshooter from "./one-time-screenshooter";

export interface WorkerTestRunnerRunOpts
    extends Pick<WorkerRunTestOpts, "sessionId" | "sessionCaps" | "sessionOpts" | "state"> {}

export interface WorkerTestRunnerCtorOpts {
    test: Test;
    file: string;
    config: BrowserConfig;
    browserAgent: BrowserAgent;
}

export interface ExecutionThreadCtorOpts {
    test: Test;
    browser: Browser;
    testplaneCtx: WorkerRunTestTestplaneCtx;
    hermioneCtx: WorkerRunTestTestplaneCtx;
    screenshooter: OneTimeScreenshooter;
}
