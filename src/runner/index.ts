import EventEmitter from "node:events";
import _ from "lodash";

import * as eventsUtils from "../events/utils.js";
import * as temp from "../temp.js";
import * as pool from "../browser-pool/index.js";
import { BrowserRunner } from "./browser-runner.js";
import {
    RunnerSyncEvents,
    MasterEvents,
    InterceptedEvent,
    RunnerSyncEvent,
    Interceptor,
    InterceptData,
} from "../events/index.js";
import { Runner } from "./runner.js";
import * as RuntimeConfig from "../config/runtime-config.js";
import WorkersRegistry from "../utils/workers-registry.js";
import PromiseGroup from "./promise-group.js";
import { TestCollection } from "../test-collection.js";
import * as logger from "../utils/logger.js";
import { Config } from "../config/index.js";

import type { runTest } from "../worker/index.js";
import type { Stats as RunnerStats } from "../stats.js";
import type { Test } from "../types/index.js";

interface WorkerMethods {
    runTest: typeof runTest;
}

export interface Workers extends EventEmitter, WorkerMethods {}

type MapOfMethods<T extends ReadonlyArray<string>> = {
    [K in T[number]]: (...args: Array<unknown>) => Promise<unknown> | unknown;
};

type RegisterWorkers<T extends ReadonlyArray<string>> = EventEmitter & MapOfMethods<T>;

export class MainRunner extends Runner {
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
        eventsUtils.passthroughEvent(this.workersRegistry, this, [MasterEvents.NEW_WORKER_PROCESS, MasterEvents.ERROR]);

        temp.init(this.config.system.tempDir);
        RuntimeConfig.getInstance().extend({ tempOpts: temp.serialize() });
    }

    init(): void {
        if (this.workers) {
            return;
        }

        this.workersRegistry.init();
        this.workers = this.workersRegistry.register(require.resolve("../worker"), ["runTest"]) as Workers;
        this.browserPool = pool.create(this.config, this);
    }

    _isRunning(): boolean {
        return this.runned && !this.workersRegistry.isEnded() && !this.cancelled;
    }

    async run(testCollection: TestCollection, stats: RunnerStats): Promise<void> {
        this.runned = true;

        try {
            await this.emitAndWait(MasterEvents.RUNNER_START, this);
            this.emit(MasterEvents.BEGIN);
            !this.cancelled && (await this._runTests(testCollection));
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

        const collection = TestCollection.create({ [browserId]: [test] });
        this.running.add(this._runTestsInBrowser(collection, browserId));

        return true;
    }

    protected async _runTests(testCollection: TestCollection): Promise<void> {
        testCollection.getBrowsers().forEach((browserId: string) => {
            this.running.add(this._runTestsInBrowser(testCollection, browserId));
        });

        return this.running.done();
    }

    protected async _runTestsInBrowser(testCollection: TestCollection, browserId: string): Promise<void> {
        const runner = BrowserRunner.create(browserId, this.config, this.browserPool, this.workers);

        eventsUtils.passthroughEvent(runner, this, this.getEventsToPassthrough());
        this.interceptEvents(runner, this.getEventsToIntercept());

        this.activeBrowserRunners.set(browserId, runner);

        await runner.run(testCollection);

        this.activeBrowserRunners.delete(browserId);
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
    }

    registerWorkers<T extends ReadonlyArray<string>>(workerFilepath: string, exportedMethods: T): RegisterWorkers<T> {
        return this.workersRegistry.register(workerFilepath, exportedMethods) as RegisterWorkers<T>;
    }
}
