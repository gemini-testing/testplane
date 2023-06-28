import Runner from "./runner";
import { BaseHermione } from "../base-hermione";
import { ImageInfo, WdioBrowser, WorkerEventHandler } from "../types";
export interface WorkerRunTestOpts {
    browserId: string;
    browserVersion: string;
    file: string;
    sessionId: string;
    sessionCaps: WdioBrowser["capabilities"];
    sessionOpts: WdioBrowser["options"];
}
export interface AssertViewResultsSuccess {
    stateName: string;
    refImg: ImageInfo;
}
export interface WorkerRunTestHermioneCtx {
    assertViewResults: Array<AssertViewResultsSuccess>;
}
export interface WorkerRunTestResult {
    meta: Record<string, unknown>;
    hermioneCtx: WorkerRunTestHermioneCtx;
}
export interface Hermione {
    on: WorkerEventHandler<this>;
    once: WorkerEventHandler<this>;
}
export declare class Hermione extends BaseHermione {
    protected runner: Runner;
    constructor(configPath: string);
    init(): Promise<void>;
    runTest(fullTitle: string, options: WorkerRunTestOpts): Promise<WorkerRunTestResult>;
    isWorker(): boolean;
}
