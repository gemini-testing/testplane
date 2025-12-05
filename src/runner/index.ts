import _ from "lodash";
import * as eventsUtils from "../events/utils";
import * as temp from "../temp";
import * as pool from "../browser-pool";
import { BrowserRunner } from "./browser-runner";
import {
    RunnerSyncEvents,
    MasterEvents,
    InterceptedEvent,
    RunnerSyncEvent,
    Interceptor,
    InterceptData,
} from "../events";
import { RunnableEmitter } from "./types";
import RuntimeConfig from "../config/runtime-config";
import WorkersRegistry from "../utils/workers-registry";
import PromiseGroup from "./promise-group";
import { TestCollection } from "../test-collection";
import * as logger from "../utils/logger";
import { Config } from "../config";
import type { runTest, cancel } from "../worker";
import type { Stats as RunnerStats } from "../stats";
import EventEmitter from "events";
import { Test } from "../types";
import { SelectivityRunner } from "../browser/cdp/selectivity/runner";

interface WorkerMethods {
    runTest: typeof runTest;
    cancel: typeof cancel;
}

export interface Workers extends EventEmitter, WorkerMethods {}

type MapOfMethods<T extends ReadonlyArray<string>> = {
    [K in T[number]]: (...args: Array<unknown>) => Promise<unknown> | unknown;
};

type RegisterWorkers<T extends ReadonlyArray<string>> = EventEmitter & MapOfMethods<T>;

interface RunnerRunOptions {
    shouldDisableSelectivity?: boolean;
}

/**
 * Part of Public API:
 * @link https://testplane.io/docs/v8/reference/testplane-events/#runner_start
 */
export class MainRunner extends RunnableEmitter {
    protected config: Config;
    protected interceptors: Interceptor[];
    protected browserPool: pool.BrowserPool | null;
    protected activeBrowserRunners: Map<string, BrowserRunner>;
    protected running: PromiseGroup;
    protected runned: boolean;
    protected cancelled: boolean;
    protected workersRegistry: WorkersRegistry;
    protected workers: Workers | null;

    constructor(config: Config, interceptors: Interceptor[]) {
        super();

        this.config = config;
        this.interceptors = interceptors;
        this.browserPool = null;

        this.activeBrowserRunners = new Map();

        this.running = new PromiseGroup();
        this.runned = false;
        this.cancelled = false;

        this.workersRegistry = WorkersRegistry.create(this.config);
        this.workers = null;
        eventsUtils.passthroughEvent(this.workersRegistry, this, [
            MasterEvents.NEW_WORKER_PROCESS,
            MasterEvents.ERROR,
            MasterEvents.DOM_SNAPSHOTS,
            MasterEvents.ADD_FILE_TO_REMOVE,
            MasterEvents.TEST_DEPENDENCIES,
        ]);

        temp.init(this.config.system.tempDir);
        RuntimeConfig.getInstance().extend({ tempOpts: temp.serialize() });
    }

    init(): void {
        if (this.workers) {
            return;
        }

        this.workersRegistry.init();
        this.workers = this.registerWorkers(require.resolve("../worker"), ["runTest", "cancel"] as const) as Workers;
        this.browserPool = pool.create(this.config, this);
    }

    _isRunning(): boolean {
        return this.runned && !this.workersRegistry.isEnded() && !this.cancelled;
    }

    async run(testCollection: TestCollection, stats: RunnerStats, opts?: RunnerRunOptions): Promise<void> {
        this.runned = true;

        try {
            await this.emitAndWait(MasterEvents.RUNNER_START, this);
            this.emit(MasterEvents.BEGIN);
            !this.cancelled && (await this._runTests(testCollection, opts));
        } finally {
            this.emit(MasterEvents.END);
            await this.emitAndWait(MasterEvents.RUNNER_END, stats.getResult()).catch(logger.warn);
            await this.workersRegistry.end();
        }
    }

    addTestToRun(test: Test, browserId: string): boolean {
        if (!this._isRunning() || this.running.isFulfilled()) {
            return false;
        }

        const runner = this.activeBrowserRunners.get(browserId);
        if (runner && runner.addTestToRun(test)) {
            return true;
        }

        const browserRunner = this._addTestToBrowserRunner(test, browserId);
        this.running.add(this._waitBrowserRunnerTestsCompletion(browserRunner));

        return true;
    }

    protected async _runTests(testCollection: TestCollection, opts?: RunnerRunOptions): Promise<void> {
        const runTestFn = this._addTestToBrowserRunner.bind(this);
        const selectivityRunner = SelectivityRunner.create(this, this.config, runTestFn, {
            shouldDisableSelectivity: opts?.shouldDisableSelectivity,
        });

        testCollection.eachTestAcrossBrowsers((test, browserId) => selectivityRunner.runIfNecessary(test, browserId));

        await selectivityRunner.waitForTestsToRun();

        this.activeBrowserRunners.forEach(runner => this.running.add(this._waitBrowserRunnerTestsCompletion(runner)));

        return this.running.done();
    }

    protected _addTestToBrowserRunner(test: Test, browserId: string): BrowserRunner {
        const browserRunner = this.activeBrowserRunners.get(browserId) || this._createBrowserRunner(browserId);
        browserRunner.addTestToRun(test);

        return browserRunner;
    }

    protected _createBrowserRunner(browserId: string): BrowserRunner {
        const runner = BrowserRunner.create(browserId, this.config, this.browserPool, this.workers);

        eventsUtils.passthroughEvent(runner, this, this.getEventsToPassthrough());
        this.interceptEvents(runner, this.getEventsToIntercept());

        this.activeBrowserRunners.set(browserId, runner);

        return runner;
    }

    protected async _waitBrowserRunnerTestsCompletion(runner: BrowserRunner): Promise<void> {
        await runner.waitTestsCompletion();
        this.activeBrowserRunners.delete(runner.browserId);
    }

    protected getEventsToPassthrough(): RunnerSyncEvent[] {
        return _(RunnerSyncEvents).values().difference(this.getEventsToIntercept()).value();
    }

    protected getEventsToIntercept(): InterceptedEvent[] {
        return _(this.interceptors).map("event").uniq().value();
    }

    protected interceptEvents(runner: BrowserRunner, events: InterceptedEvent[]): void {
        events.forEach((event: InterceptedEvent) => {
            runner.on(event, data => {
                try {
                    const toEmit = this.applyInterceptors({ event, data }, this.interceptors);
                    toEmit && toEmit.event && this.emit(toEmit.event, toEmit.data);
                } catch (e) {
                    this.emit(MasterEvents.ERROR, e);
                }
            });
        });
    }

    protected applyInterceptors(
        { event, data }: Partial<InterceptData> = {},
        interceptors: Interceptor[],
    ): Partial<InterceptData> {
        const interceptor = _.find(interceptors, { event });
        if (!interceptor) {
            return { event, data };
        }

        return this.applyInterceptors(
            interceptor.handler({ event, data }) || { event, data },
            _.without(interceptors, interceptor),
        );
    }

    cancel(): void {
        this.cancelled = true;
        this.browserPool?.cancel();

        this.activeBrowserRunners.forEach(runner => runner.cancel());

        this.workers?.cancel();
    }

    registerWorkers<T extends ReadonlyArray<string>>(workerFilepath: string, exportedMethods: T): RegisterWorkers<T> {
        return this.workersRegistry.register(workerFilepath, exportedMethods) as RegisterWorkers<T>;
    }
}
