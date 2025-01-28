import Runner from "./runner";
import { BaseTestplane } from "../base-testplane";
import { RefImageInfo, WdioBrowser, WorkerEventHandler } from "../types";
import { ConfigInput } from "../config/types";
import { Testrunner } from "@testplane/types/build/Options";
export interface WorkerRunTestOpts {
    browserId: string;
    browserVersion: string;
    file: string;
    sessionId: string;
    sessionCaps: WdioBrowser["capabilities"];
    sessionOpts: Testrunner;
    state: Record<string, unknown>;
}
export interface AssertViewResultsSuccess {
    stateName: string;
    refImg: RefImageInfo;
}
export interface WorkerRunTestTestplaneCtx {
    assertViewResults: Array<AssertViewResultsSuccess>;
}
export interface WorkerRunTestResult {
    meta: Record<string, unknown>;
    testplaneCtx: WorkerRunTestTestplaneCtx;
    /**
     * @deprecated Use `testplaneCtx` instead
     */
    hermioneCtx: WorkerRunTestTestplaneCtx;
}
export interface Testplane {
    on: WorkerEventHandler<this>;
    once: WorkerEventHandler<this>;
}
export declare class Testplane extends BaseTestplane {
    protected runner: Runner;
    constructor(config?: string | ConfigInput);
    init(): Promise<void>;
    runTest(fullTitle: string, options: WorkerRunTestOpts): Promise<WorkerRunTestResult>;
    isWorker(): boolean;
}
