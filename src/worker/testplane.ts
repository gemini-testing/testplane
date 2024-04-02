import { passthroughEvent } from "../events/utils";
import { WorkerEvents } from "../events";
import Runner from "./runner";
import { BaseTestplane } from "../base-testplane";
import { ImageInfo, WdioBrowser, WorkerEventHandler } from "../types";

export interface WorkerRunTestOpts {
    browserId: string;
    browserVersion: string;
    file: string;
    sessionId: string;
    sessionCaps: WdioBrowser["capabilities"];
    sessionOpts: WdioBrowser["options"];
    state: Record<string, unknown>;
}

export interface AssertViewResultsSuccess {
    stateName: string;
    refImg: ImageInfo;
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

export class Testplane extends BaseTestplane {
    protected runner: Runner;

    constructor(configPath: string) {
        super(configPath);

        this.runner = Runner.create(this._config);

        passthroughEvent(this.runner, this, [
            WorkerEvents.BEFORE_FILE_READ,
            WorkerEvents.AFTER_FILE_READ,
            WorkerEvents.AFTER_TESTS_READ,
            WorkerEvents.NEW_BROWSER,
            WorkerEvents.UPDATE_REFERENCE,
        ]);
    }

    async init(): Promise<void> {
        await this._init();

        if (!global.expect) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { setOptions } = require("expect-webdriverio");
            setOptions(this._config.system.expectOpts);
        }
    }

    runTest(fullTitle: string, options: WorkerRunTestOpts): Promise<WorkerRunTestResult> {
        return this.runner.runTest(fullTitle, options);
    }

    isWorker(): boolean {
        return true;
    }
}
