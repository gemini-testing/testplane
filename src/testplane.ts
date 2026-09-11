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
import { resolveExitCode } from "./utils/exit-code";
import { initDevServer } from "./dev-server";
import { ConfigInput } from "./config/types";
import { MasterEventHandler, Test, TestResult, WorkerEventHandler } from "./types";
import { preloadWebdriverIO } from "./utils/preload-utils";
import { clearUnusedSelectivityDumps, updateSelectivityHashes } from "./browser/cdp/selectivity";
import { TagFilter } from "./utils/cli";
import { ViteServer } from "./runner/browser-env/vite/server";
import { getGlobalFilesToRemove, initGlobalFilesToRemove } from "./globalFilesToRemove";
import { TestsTracker, formatTrackedTests, getTestsByWorkerPid } from "./runner/tests-tracker";
import { UnhandledRejectionError } from "./errors/unhandled-rejection-error";
import { ProfilerSanitizer } from "./profiler/sanitize";
import type { SourceRef } from "./profiler/schema";

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
        port?: number;
    };
    local: boolean;
    keepBrowserMode: {
        enabled: boolean;
        onFail: boolean;
    };
}

const configCallbackSource = (configPath: string | undefined, functionName?: string): SourceRef => ({
    file: configPath ? new ProfilerSanitizer().path(configPath) : undefined,
    functionName,
    confidence: configPath ? "medium" : "low",
});

const CONFIG_HOOK_PHASES = {
    beforeAll: { kind: "testplane.phase.before-all", name: "Run beforeAll" },
    afterAll: { kind: "testplane.phase.after-all", name: "Run afterAll" },
} as const;

type ConfigHookName = keyof typeof CONFIG_HOOK_PHASES;

export type FailedListItem = {
    browserVersion?: string;
    browserId?: string;
    fullTitle: string;
};

interface RunnableOpts {
    saveLocations?: boolean;
    saveHookLocations?: boolean;
}

export interface ReadTestsOpts
    extends Pick<RunOpts, "tag" | "browsers" | "sets" | "grep" | "replMode" | "keepBrowserMode"> {
    silent: boolean;
    ignore: string | string[];
    failed: FailedListItem[];
    runnableOpts?: RunnableOpts;
}

interface WorkerEventEmitter<T extends BaseTestplane> {
    on: WorkerEventHandler<T>;
    once: WorkerEventHandler<T>;
    prependListener: WorkerEventHandler<T>;
}

export interface Testplane {
    on: MasterEventHandler<this>;
    once: MasterEventHandler<this>;
    prependListener: MasterEventHandler<this>;
}

interface ErrorWithWorkerPid extends Error {
    workerPid?: number;
}

export class Testplane extends BaseTestplane {
    protected failed: boolean;
    protected failedList: FailedListItem[];
    protected runner: MainRunner | null;
    protected viteServer: ViteServer | null;

    private _filesToRemove: string[];
    protected testsTracker: TestsTracker | null;

    constructor(config?: string | ConfigInput) {
        super(config);

        this.failed = false;
        this.failedList = [];
        this.runner = null;
        this.viteServer = null;

        this._filesToRemove = [];

        this.testsTracker = null;

        this.on(MasterEvents.EXIT, (error?: Error) => {
            if (!this._profiler?.isEnabled()) {
                return;
            }
            this._profiler.abort({
                code: "SIGNAL",
                message: this._profiler.sanitizeMessage(error?.message ?? "Process termination signal received"),
            });
        });
    }

    async extendCli(parser: Command): Promise<void> {
        await this.emitAndWait(MasterEvents.CLI, parser);
    }

    addFileToRemove(path: string): void {
        this._filesToRemove.push(path);
    }

    protected async _startServersIfNeeded(): Promise<void> {
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
    }

    async run(testPaths: TestCollection | string[], options: Partial<RunOpts> = {}): Promise<boolean> {
        const finalizeAfterSignal = async (...args: unknown[]): Promise<void> => {
            try {
                await this.emitAndWait(MasterEvents.RUNNER_END, ...args);
            } finally {
                await this._profiler.finalizeSafely();
            }
        };
        signalHandler.once(MasterEvents.RUNNER_END, finalizeAfterSignal);
        try {
            return await this._profiler.profileOperation("run", () => this._run(testPaths, options));
        } finally {
            signalHandler.off(MasterEvents.RUNNER_END, finalizeAfterSignal);
        }
    }

    private async _run(
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
            local,
            keepBrowserMode,
            reporters = [],
        }: Partial<RunOpts>,
    ): Promise<boolean> {
        validateUnknownBrowsers(browsers!, _.keys(this._config.browsers));

        RuntimeConfig.getInstance().extend({
            updateRefs,
            requireModules,
            inspectMode,
            replMode,
            local,
            keepBrowserMode,
        });

        if (replMode?.enabled) {
            this._config.system.mochaOpts.timeout = 0;
        }

        const RunnerClass = await import("./runner").then(m => m.MainRunner);

        const runner = RunnerClass.create(this._config, this._interceptors, this._profiler.runtime);
        this.runner = runner;

        this.on(MasterEvents.TEST_FAIL, res => {
            this._fail();
            this._addFailedTest(res);
        });

        this.on(MasterEvents.ERROR, (err: ErrorWithWorkerPid) => this._handleError(err));

        this.on(MasterEvents.RUNNER_END, async () => await this._saveFailed());

        this.on(MasterEvents.ADD_FILE_TO_REMOVE, this.addFileToRemove);

        this.testsTracker = new TestsTracker(this);

        await this._profiler.runtime.withSpan("testplane.phase.reporters", { name: "Initialize reporters" }, () =>
            initReporters(reporters, this),
        );

        eventsUtils.passthroughEvent(this.runner, this, _.values(MasterSyncEvents));
        eventsUtils.passthroughEventAsync(
            this.runner,
            this,
            _.without(_.values(MasterAsyncEvents), MasterEvents.PROFILER_RESULT),
        );
        eventsUtils.passthroughEventAsync(signalHandler, this, MasterEvents.EXIT);
        eventsUtils.passthroughEventAsync(signalHandler, this.runner, MasterEvents.EXIT);

        await this._profiler.runtime.withSpan(
            "testplane.phase.server-startup",
            { name: "Start development servers" },
            () => this._startServersIfNeeded(),
        );
        await this._emitInitEventOnce();

        this._profiler.runtime.withSpan(
            "testplane.phase.runner-init",
            { name: "Initialize runner and workers" },
            () => {
                runner.init();
                preloadWebdriverIO();
                initGlobalFilesToRemove();
            },
        );

        await this._runConfigHook("beforeAll");

        const hasTestPathsFilter = _.isArray(testPaths) ? Boolean(testPaths.length) : true;
        const hasTestFilter = hasTestPathsFilter || Boolean(sets?.length) || Boolean(grep) || Boolean(tag);
        const shouldDisableSelectivity = Boolean(hasTestFilter);

        const collection = await this._profiler.runtime.withSpan(
            "testplane.phase.read-tests",
            { name: "Read tests" },
            () => this._readTests(testPaths, { browsers, sets, grep, tag, replMode, keepBrowserMode }),
        );
        await this._profiler.runtime.withSpan("testplane.phase.execution", { name: "Execute tests" }, () =>
            runner.run(collection, RunnerStats.create(this), { shouldDisableSelectivity }),
        );

        if (!shouldDisableSelectivity) {
            const [updateResult, clearResult] = await this._profiler.runtime.withSpan(
                "testplane.phase.selectivity",
                { name: "Update selectivity state" },
                () =>
                    Promise.allSettled([
                        updateSelectivityHashes(this.config, this.isFailed()),
                        clearUnusedSelectivityDumps(this.config, this.isFailed()),
                    ]),
            );

            if (updateResult.status === "rejected") {
                console.error("Couldn't update selectivity state: ", updateResult.reason);
            }

            if (clearResult.status === "rejected") {
                console.error("Couldn't clear stale selectivity files: ", clearResult.reason);
            }
        }

        await this._runConfigHook("afterAll");

        const filesToRemove = [...new Set([...this._filesToRemove, ...getGlobalFilesToRemove()])];

        if (filesToRemove.length > 0) {
            await this._profiler.runtime.withSpan("testplane.phase.cleanup", { name: "Clean temporary files" }, () =>
                Promise.all(filesToRemove.map(path => fs.remove(path))),
            );
        }

        return !this.isFailed();
    }

    private async _runConfigHook(name: ConfigHookName): Promise<void> {
        const hook = this.config[name];
        if (!hook) {
            return;
        }

        const runtime = this._profiler.runtime;
        await runtime.withSpan(CONFIG_HOOK_PHASES[name].kind, { name: CONFIG_HOOK_PHASES[name].name }, () =>
            runtime.withSpan(
                "user.callback",
                {
                    minLevel: 2,
                    name: hook.name || name,
                    source: runtime.isEnabled(2) ? configCallbackSource(this._config.configPath, hook.name) : undefined,
                    attributes: { callback: name },
                },
                () => hook.call({ config: this.config }, { config: this.config }),
            ),
        );
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

    async readTests(testPaths: string[], options: Partial<ReadTestsOpts> = {}): Promise<TestCollection> {
        return this._profiler.profileOperation("readTests", () => this._readTestsOperation(testPaths, options));
    }

    private async _readTestsOperation(
        testPaths: string[],
        { browsers, sets, grep, tag, silent, ignore, replMode, keepBrowserMode, runnableOpts }: Partial<ReadTestsOpts>,
    ): Promise<TestCollection> {
        const testReader = TestReader.create(this._config, this._profiler.runtime);

        if (!silent) {
            await this._emitInitEventOnce();

            eventsUtils.passthroughEvent(testReader, this, [
                MasterEvents.BEFORE_FILE_READ,
                MasterEvents.AFTER_FILE_READ,
            ]);
        }

        const specs = await this._profiler.runtime.withSpan(
            "testplane.phase.test-discovery",
            { name: "Discover and load test files" },
            () =>
                testReader.read({
                    paths: testPaths,
                    browsers,
                    ignore,
                    sets,
                    grep,
                    tag,
                    replMode,
                    keepBrowserMode,
                    runnableOpts,
                }),
        );

        const collection = this._profiler.runtime.withSpan(
            "testplane.phase.collection-build",
            { name: "Build test collection" },
            () => TestCollection.create(specs),
        );

        this._profiler.runtime.withSpan("testplane.phase.collection-sort", { name: "Sort test collection" }, () =>
            collection.getBrowsers().forEach(bro => {
                if (this._config.forBrowser(bro).strictTestsOrder) {
                    collection.sortTests(bro, ({ id: a }, { id: b }) => (a < b ? -1 : 1));
                }
            }),
        );

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

    isWorker(): this is this & WorkerEventEmitter<this> {
        return false;
    }

    private _handleError(err: ErrorWithWorkerPid): void {
        if (err && err.workerPid && this.testsTracker) {
            const allTests = this.testsTracker.getAllTests();
            const relevantTests = getTestsByWorkerPid(allTests, err.workerPid);
            const topTests = relevantTests.slice(0, 5);

            const unhandledErrorWithAllTestsHint = new UnhandledRejectionError({
                testsHint: formatTrackedTests(relevantTests),
                workerPid: err.workerPid,
                error: err,
            });
            const unhandledErrorWithTopTestsHint = new UnhandledRejectionError({
                testsHint: formatTrackedTests(topTests),
                workerPid: err.workerPid,
                error: err,
            });

            this.once(MasterEvents.RUNNER_END, () => {
                logger.error("\n\n", logger.withLogOptions({ timestamp: false }));
                logger.error("Terminating on critical error:", unhandledErrorWithAllTestsHint);
            });

            // Slice tests list to 5 to avoid blowing up reporter size, because this message will be duplicated for each test
            this.halt(unhandledErrorWithTopTestsHint, 60000, false);
        } else {
            this.halt(err);
        }
    }

    halt(err: Error, timeout = 60000, logError = true): void {
        if (logError) {
            logger.error("Terminating on critical error:", err);
        }

        this._fail();
        this._profiler.addPartialReason({
            code: "CONTROLLED_ABORT",
            message: this._profiler.sanitizeMessage(err?.message ?? "Testplane run was aborted"),
        });

        const cancelRunner = (): void => {
            signalHandler.emit(MasterEvents.EXIT, err);
            this.runner?.cancel(err);
        };
        const hasRunningTests = this.testsTracker?.getAllTests().some(test => test.isRunning);

        if (timeout > 0) {
            setTimeout(() => {
                logger.error("Forcing shutdown...");
                logger.error(err);
                process.exit(resolveExitCode(1));
            }, timeout).unref();
        }

        if (this.viteServer) {
            this.viteServer.close();
        }

        if (timeout > 0 || hasRunningTests) {
            cancelRunner();
        } else {
            this.once(MasterEvents.TEST_BEGIN, cancelRunner);
        }
    }
}
