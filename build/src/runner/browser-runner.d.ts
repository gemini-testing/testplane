import { Runner } from "./runner";
import { InterceptedEvent } from "../events";
import { Config } from "../config";
import { BrowserPool } from "../browser-pool";
import { Workers } from "./index";
import type { Test } from "../types";
import { TestCollection } from "../test-collection";
export interface BrowserRunner {
    on(event: InterceptedEvent, handler: (test: Test) => void): this;
}
export declare class BrowserRunner extends Runner {
    private _browserId;
    private config;
    private browserPool;
    private suiteMonitor;
    private activeTestRunners;
    private workers;
    private running;
    constructor(browserId: string, config: Config, browserPool: BrowserPool, workers: Workers);
    get browserId(): string;
    run(testCollection: TestCollection): Promise<void>;
    addTestToRun(test: Test): boolean;
    private _runTest;
    cancel(): void;
    private passthroughEvents;
}
