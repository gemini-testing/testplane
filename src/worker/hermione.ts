import { passthroughEvent } from "../events/utils.js";
import { WorkerEvents } from "../events/index.js";
import Runner from "./runner/index.js";
import { BaseHermione } from "../base-hermione.js";
import { ImageInfo, WdioBrowser, WorkerEventHandler } from "../types/index.js";

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

export class Hermione extends BaseHermione {
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
