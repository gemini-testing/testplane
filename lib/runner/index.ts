import _ from 'lodash';
import { events, temp } from 'gemini-core';

import * as pool from '../browser-pool';
import BrowserRunner from './browser-runner';
import Runner from './runner';
import * as RuntimeConfig from '../config/runtime-config';
import Events from '../constants/runner-events';
import PromiseGroup from './promise-group';
import TestCollection from '../test-collection';
import * as logger from '../utils/logger';
import WorkersRegistry from '../utils/workers-registry';

import type { EventEmitter } from 'events';
import type { Pool } from 'gemini-core/lib/types/pool';
import type { Interceptor } from '../base-hermione';
import type Config from '../config';
import type * as Worker from '../worker';

export default class MainRunner extends Runner {
    private _config: Config;
    private _interceptors: Array<Interceptor>;
    private _browserPool: Pool | null;
    private _activeBrowserRunners: Map<string, BrowserRunner>;
    private _running: PromiseGroup;
    private _runned: boolean;
    private _cancelled: boolean;
    private _workersRegistry: WorkersRegistry;
    private _workers: EventEmitter & Pick<typeof Worker, 'runTest'> | null;

    constructor(config: Config, interceptors: Array<Interceptor>) {
        super();

        this._config = config;
        this._interceptors = interceptors;
        this._browserPool = null;

        this._activeBrowserRunners = new Map();

        this._running = new PromiseGroup();
        this._runned = false;
        this._cancelled = false;

        this._workersRegistry = WorkersRegistry.create(this._config);
        this._workers = null;
        events.utils.passthroughEvent(this._workersRegistry, this, [Events.NEW_WORKER_PROCESS]);

        temp.init(this._config.system.tempDir);
        RuntimeConfig.getInstance().extend({tempOpts: temp.serialize()});
    }

    public init(): void {
        if (this._workers) {
            return;
        }

        this._workersRegistry.init();
        this._workers = this._workersRegistry.register<typeof Worker>(require.resolve('../worker'), ['runTest']);
        this._browserPool = pool.create(this._config, this);
    }

    private _isRunning(): boolean {
        return this._runned && !this._workersRegistry.isEnded() && !this._cancelled;
    }

    public async run(testCollection: TestCollection, stats): Promise<void> {
        this._runned = true;

        try {
            await this.emitAndWait(Events.RUNNER_START, this);
            this.emit(Events.BEGIN);
            !this._cancelled && await this._runTests(testCollection);
        } finally {
            this.emit(Events.END);
            await this.emitAndWait(Events.RUNNER_END, stats.getResult()).catch(logger.warn);
            await this._workersRegistry.end();
        }
    }

    addTestToRun(test, browserId) {
        if (!this._isRunning() || this._running.isFulfilled()) {
            return false;
        }

        const runner = this._activeBrowserRunners.get(browserId);
        if (runner && runner.addTestToRun(test)) {
            return true;
        }

        const collection = TestCollection.create({[browserId]: [test]}, this._config);
        this._running.add(this._runTestsInBrowser(collection, browserId));

        return true;
    }

    _runTests(testCollection) {
        testCollection.getBrowsers().forEach((browserId) => {
            this._running.add(this._runTestsInBrowser(testCollection, browserId));
        });

        return this._running.done();
    }

    async _runTestsInBrowser(testCollection, browserId) {
        const runner = BrowserRunner.create(browserId, this._config, this._browserPool, this._workers);

        events.utils.passthroughEvent(runner, this, this._getEventsToPassthrough());
        this._interceptEvents(runner, this._getEventsToIntercept());

        this._activeBrowserRunners.set(browserId, runner);

        await runner.run(testCollection);

        this._activeBrowserRunners.delete(browserId);
    }

    _getEventsToPassthrough() {
        return _(Events.getRunnerSync()).values().difference(this._getEventsToIntercept()).value();
    }

    _getEventsToIntercept() {
        return _(this._interceptors).map('event').uniq().value();
    }

    _interceptEvents(runner, events) {
        events.forEach((event) => {
            runner.on(event, (data) => {
                try {
                    const toEmit = this._applyInterceptors({event, data}, this._interceptors);
                    toEmit && toEmit.event && this.emit(toEmit.event, toEmit.data);
                } catch (e) {
                    this.emit(Events.ERROR, e);
                }
            });
        });
    }

    private _applyInterceptors({event, data} = {}, interceptors) {
        const interceptor = _.find(interceptors, {event});
        if (!interceptor) {
            return {event, data};
        }

        return this._applyInterceptors(interceptor.handler({event, data}) || {event, data}, _.without(interceptors, interceptor));
    }

    public cancel(): void {
        this._cancelled = true;
        (this._browserPool as Pool).cancel();

        this._activeBrowserRunners.forEach((runner) => runner.cancel());
    }

    public registerWorkers(workerFilepath: string, exportedMethods) {
        return this._workersRegistry.register(workerFilepath, exportedMethods);
    }
};
