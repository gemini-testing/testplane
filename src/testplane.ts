import { CommanderStatic } from "@gemini-testing/commander";
import _ from "lodash";
import { Stats as RunnerStats } from "./stats";
import { BaseTestplane } from "./base-testplane";
import { MainRunner as NodejsEnvRunner } from "./runner";
import { MainRunner as BrowserEnvRunner } from "./runner/browser-env";
import RuntimeConfig from "./config/runtime-config";
import { MasterAsyncEvents, MasterEvents, MasterSyncEvents } from "./events";
import eventsUtils from "./events/utils";
import signalHandler from "./signal-handler";
import TestReader from "./test-reader";
import { TestCollection } from "./test-collection";
import { validateUnknownBrowsers } from "./validators";
import { initReporters } from "./reporters";
import logger from "./utils/logger";
import { isRunInNodeJsEnv } from "./utils/config";
import { initDevServer } from "./dev-server";
import { ConfigInput } from "./config/types";
import { MasterEventHandler, Test, TestResult } from "./types";
import * as fs from "fs/promises";
import path from "path";

interface RunOpts {
    browsers: string[];
    sets: string[];
    grep: RegExp;
    updateRefs: boolean;
    runFailed: boolean;
    requireModules: string[];
    inspectMode: {
        inspect: boolean;
        inspectBrk: boolean;
    };
    reporters: string[];
    replMode: {
        enabled: boolean;
        beforeTest: boolean;
        onFail: boolean;
    };
    devtools: boolean;
}

interface ReadTestsOpts extends Pick<RunOpts, "browsers" | "sets" | "grep" | "replMode"> {
    silent: boolean;
    ignore: string | string[];
}

export interface Testplane {
    on: MasterEventHandler<this>;
    once: MasterEventHandler<this>;
    prependListener: MasterEventHandler<this>;
}

export type FailedListItem = {
    browserId?: string;
    fullTitle: string;
};

export class Testplane extends BaseTestplane {
    protected failed: boolean;
    protected failedList: FailedListItem[];
    protected runner: NodejsEnvRunner | BrowserEnvRunner | null;

    constructor(config?: string | ConfigInput) {
        super(config);

        this.failed = false;
        this.failedList = [];
        this.runner = null;
    }

    extendCli(parser: CommanderStatic): void {
        this.emit(MasterEvents.CLI, parser);
    }

    protected async _init(): Promise<void> {
        await initDevServer({
            testplane: this,
            devServerConfig: this._config.devServer,
            configPath: this._config.configPath,
        });

        return super._init();
    }

    async run(
        testPaths: TestCollection | string[],
        {
            browsers,
            sets,
            grep,
            updateRefs,
            runFailed,
            requireModules,
            inspectMode,
            replMode,
            devtools,
            reporters = [],
        }: Partial<RunOpts> = {},
    ): Promise<boolean> {
        validateUnknownBrowsers(browsers, _.keys(this._config.browsers));

        RuntimeConfig.getInstance().extend({ updateRefs, requireModules, inspectMode, replMode, devtools });

        if (replMode?.enabled) {
            this._config.system.mochaOpts.timeout = 0;
        }

        const runner = (isRunInNodeJsEnv(this._config) ? NodejsEnvRunner : BrowserEnvRunner).create(
            this._config,
            this._interceptors,
        );
        this.runner = runner;

        this.on(MasterEvents.TEST_FAIL, () => this._fail());
        this.on(MasterEvents.TEST_FAIL, res => this._addFailedTest(res));
        this.on(MasterEvents.ERROR, (err: Error) => this.halt(err));

        if (runFailed) {
            let previousRunFailedTests: FailedListItem[];
            this.on(MasterEvents.INIT, async () => {
                previousRunFailedTests = await this._readFailed();
            });

            this.on(MasterEvents.AFTER_TESTS_READ, testCollection => {
                if (previousRunFailedTests.length) {
                    testCollection.disableAll();
                    previousRunFailedTests.forEach(({ fullTitle, browserId }) => {
                        testCollection.enableTest(fullTitle, browserId);
                    });
                }
            });
        }

        this.on(MasterEvents.RUNNER_END, async () => {
            await this._saveFailed();
        });

        await initReporters(reporters, this);

        eventsUtils.passthroughEvent(this.runner, this, _.values(MasterSyncEvents));
        eventsUtils.passthroughEventAsync(this.runner, this, _.values(MasterAsyncEvents));
        eventsUtils.passthroughEventAsync(signalHandler, this, MasterEvents.EXIT);

        await this._init();
        runner.init();
        await runner.run(
            await this._readTests(testPaths, { browsers, sets, grep, replMode }),
            RunnerStats.create(this),
        );

        return !this.isFailed();
    }

    protected async _readFailed(): Promise<FailedListItem[]> {
        try {
            const data = await fs.readFile(this._config.failedTestsPath, "utf8");
            return JSON.parse(data);
        } catch {
            return [];
        }
    }

    protected async _saveFailed(): Promise<void> {
        const dirname = path.dirname(this._config.failedTestsPath);
        try {
            await fs.access(dirname);
        } catch {
            await fs.mkdir(dirname, { recursive: true });
        }
        await fs.writeFile(this._config.failedTestsPath, JSON.stringify(this.failedList));
    }

    protected async _readTests(
        testPaths: string[] | TestCollection,
        opts: Partial<ReadTestsOpts>,
    ): Promise<TestCollection> {
        return testPaths instanceof TestCollection ? testPaths : await this.readTests(testPaths, opts);
    }

    addTestToRun(test: Test, browserId: string): boolean {
        return this.runner ? this.runner.addTestToRun(test, browserId) : false;
    }

    async readTests(
        testPaths: string[],
        { browsers, sets, grep, silent, ignore, replMode }: Partial<ReadTestsOpts> = {},
    ): Promise<TestCollection> {
        const testReader = TestReader.create(this._config);

        if (!silent) {
            await this._init();

            eventsUtils.passthroughEvent(testReader, this, [
                MasterEvents.BEFORE_FILE_READ,
                MasterEvents.AFTER_FILE_READ,
            ]);
        }

        const specs = await testReader.read({ paths: testPaths, browsers, ignore, sets, grep, replMode });
        const collection = TestCollection.create(specs);

        collection.getBrowsers().forEach(bro => {
            if (this._config.forBrowser(bro).strictTestsOrder) {
                collection.sortTests(bro, ({ id: a }, { id: b }) => (a < b ? -1 : 1));
            }
        });

        if (!silent) {
            this.emit(MasterEvents.AFTER_TESTS_READ, collection);
        }

        return collection;
    }

    isFailed(): boolean {
        return this.failed;
    }

    protected _fail(): void {
        this.failed = true;
    }

    protected _addFailedTest(result: TestResult): void {
        this.failedList.push({
            fullTitle: result.fullTitle(),
            browserId: result.browserId,
        });
        this._saveFailed();
    }

    isWorker(): boolean {
        return false;
    }

    halt(err: Error, timeout = 60000): void {
        logger.error("Terminating on critical error:", err);

        this._fail();

        if (timeout > 0) {
            setTimeout(() => {
                logger.error("Forcing shutdown...");
                process.exit(1);
            }, timeout).unref();
        }

        if (this.runner) {
            this.runner.cancel();
        }
    }
}
