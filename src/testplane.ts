import { Command } from "@gemini-testing/commander";
import _ from "lodash";
import fs from "fs-extra";
import { Stats as RunnerStats } from "./stats";
import { BaseTestplane } from "./base-testplane";
import type { MainRunner } from "./runner";
import RuntimeConfig from "./config/runtime-config";
import { MasterAsyncEvents, MasterEvents, MasterSyncEvents } from "./events";
import eventsUtils from "./events/utils";
import signalHandler from "./signal-handler";
import { TestReader } from "./test-reader";
import { TestCollection } from "./test-collection";
import { validateUnknownBrowsers } from "./validators";
import { initReporters } from "./reporters";
import * as logger from "./utils/logger";
import { isRunInNodeJsEnv } from "./utils/config";
import { initDevServer } from "./dev-server";
import { ConfigInput } from "./config/types";
import { MasterEventHandler, Test, TestResult } from "./types";
import { preloadWebdriverIO } from "./utils/preload-utils";
import { updateSelectivityHashes } from "./browser/cdp/selectivity";
import { TagFilter } from "./utils/cli";
import { ViteServer } from "./runner/browser-env/vite/server";

interface RunOpts {
    browsers: string[];
    sets: string[];
    grep: RegExp;
    tag: TagFilter;
    updateRefs: boolean;
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
    local: boolean;
    keepBrowserMode: {
        enabled: boolean;
        onFail: boolean;
    };
}

export type FailedListItem = {
    browserVersion?: string;
    browserId?: string;
    fullTitle: string;
};

interface RunnableOpts {
    saveLocations?: boolean;
}

export interface ReadTestsOpts
    extends Pick<RunOpts, "tag" | "browsers" | "sets" | "grep" | "replMode" | "keepBrowserMode"> {
    silent: boolean;
    ignore: string | string[];
    failed: FailedListItem[];
    runnableOpts?: RunnableOpts;
}

export interface Testplane {
    on: MasterEventHandler<this>;
    once: MasterEventHandler<this>;
    prependListener: MasterEventHandler<this>;
}

export class Testplane extends BaseTestplane {
    protected failed: boolean;
    protected failedList: FailedListItem[];
    protected runner: MainRunner | null;
    protected viteServer: ViteServer | null;

    constructor(config?: string | ConfigInput) {
        super(config);

        this.failed = false;
        this.failedList = [];
        this.runner = null;
        this.viteServer = null;
    }

    extendCli(parser: Command): void {
        this.emit(MasterEvents.CLI, parser);
    }

    protected async _init(): Promise<void> {
        await initDevServer({
            testplane: this,
            devServerConfig: this._config.devServer,
            configPath: this._config.configPath,
        });

        if (!isRunInNodeJsEnv(this._config)) {
            try {
                this.viteServer = ViteServer.create(this._config);
                await this.viteServer.start();
            } catch (err) {
                throw new Error(`Vite server failed to start: ${(err as Error).message}`);
            }
        }

        return super._init();
    }

    async run(
        testPaths: TestCollection | string[],
        {
            browsers,
            sets,
            grep,
            tag,
            updateRefs,
            requireModules,
            inspectMode,
            replMode,
            devtools,
            local,
            keepBrowserMode,
            reporters = [],
        }: Partial<RunOpts> = {},
    ): Promise<boolean> {
        validateUnknownBrowsers(browsers!, _.keys(this._config.browsers));

        RuntimeConfig.getInstance().extend({
            updateRefs,
            requireModules,
            inspectMode,
            replMode,
            devtools,
            local,
            keepBrowserMode,
        });

        if (replMode?.enabled) {
            this._config.system.mochaOpts.timeout = 0;
        }

        const RunnerClass = await import("./runner").then(m => m.MainRunner);

        const runner = RunnerClass.create(this._config, this._interceptors);
        this.runner = runner;

        this.on(MasterEvents.TEST_FAIL, res => {
            this._fail();
            this._addFailedTest(res);
        });
        this.on(MasterEvents.ERROR, (err: Error) => this.halt(err));

        this.on(MasterEvents.RUNNER_END, async () => await this._saveFailed());

        await initReporters(reporters, this);

        eventsUtils.passthroughEvent(this.runner, this, _.values(MasterSyncEvents));
        eventsUtils.passthroughEventAsync(this.runner, this, _.values(MasterAsyncEvents));
        eventsUtils.passthroughEventAsync(signalHandler, this, MasterEvents.EXIT);

        await this._init();

        runner.init();

        preloadWebdriverIO();

        if (this.config.beforeAll) {
            await this.config.beforeAll.call({ config: this.config }, { config: this.config });
        }

        const hasTestPathsFilter = _.isArray(testPaths) ? Boolean(testPaths.length) : true;
        const hasTestFilter = hasTestPathsFilter || Boolean(sets?.length) || Boolean(grep) || Boolean(tag);
        const shouldDisableSelectivity = Boolean(hasTestFilter);

        await runner.run(
            await this._readTests(testPaths, { browsers, sets, grep, tag, replMode, keepBrowserMode }),
            RunnerStats.create(this),
            { shouldDisableSelectivity },
        );

        if (!shouldDisableSelectivity && !this.isFailed()) {
            await updateSelectivityHashes(this.config);
        }

        if (this.config.afterAll) {
            await this.config.afterAll.call({ config: this.config }, { config: this.config });
        }

        return !this.isFailed();
    }

    protected async _saveFailed(): Promise<void> {
        await fs.outputJSON(this._config.lastFailed.output, this.failedList); // No spaces because users usually don't need to read it
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
        {
            browsers,
            sets,
            grep,
            tag,
            silent,
            ignore,
            replMode,
            keepBrowserMode,
            runnableOpts,
        }: Partial<ReadTestsOpts> = {},
    ): Promise<TestCollection> {
        const testReader = TestReader.create(this._config);

        if (!silent) {
            await this._init();

            eventsUtils.passthroughEvent(testReader, this, [
                MasterEvents.BEFORE_FILE_READ,
                MasterEvents.AFTER_FILE_READ,
            ]);
        }

        const specs = await testReader.read({
            paths: testPaths,
            browsers,
            ignore,
            sets,
            grep,
            tag,
            replMode,
            keepBrowserMode,
            runnableOpts,
        });

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
            browserVersion: result.browserVersion,
        });
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

        if (this.viteServer) {
            this.viteServer.close();
        }

        if (this.runner) {
            this.runner.cancel();
        }
    }
}
