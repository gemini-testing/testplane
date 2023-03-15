"use strict";

const _ = require("lodash");
const eventsUtils = require("../events/utils");
const temp = require("../temp");

const pool = require("../browser-pool");
const BrowserRunner = require("./browser-runner");
const Events = require("../constants/runner-events");
const Runner = require("./runner");
const RuntimeConfig = require("../config/runtime-config");
const WorkersRegistry = require("../utils/workers-registry");
const PromiseGroup = require("./promise-group");
const TestCollection = require("../test-collection").default;
const logger = require("../utils/logger");

module.exports = class MainRunner extends Runner {
    constructor(config, interceptors) {
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
        eventsUtils.passthroughEvent(this._workersRegistry, this, [Events.NEW_WORKER_PROCESS]);

        temp.init(this._config.system.tempDir);
        RuntimeConfig.getInstance().extend({ tempOpts: temp.serialize() });
    }

    init() {
        if (this._workers) {
            return;
        }

        this._workersRegistry.init();
        this._workers = this._workersRegistry.register(require.resolve("../worker"), ["runTest"]);
        this._browserPool = pool.create(this._config, this);
    }

    _isRunning() {
        return this._runned && !this._workersRegistry.isEnded() && !this._cancelled;
    }

    async run(testCollection, stats) {
        this._runned = true;

        try {
            await this.emitAndWait(Events.RUNNER_START, this);
            this.emit(Events.BEGIN);
            !this._cancelled && (await this._runTests(testCollection));
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

        const collection = TestCollection.create({ [browserId]: [test] }, this._config);
        this._running.add(this._runTestsInBrowser(collection, browserId));

        return true;
    }

    _runTests(testCollection) {
        testCollection.getBrowsers().forEach(browserId => {
            this._running.add(this._runTestsInBrowser(testCollection, browserId));
        });

        return this._running.done();
    }

    async _runTestsInBrowser(testCollection, browserId) {
        const runner = BrowserRunner.create(browserId, this._config, this._browserPool, this._workers);

        eventsUtils.passthroughEvent(runner, this, this._getEventsToPassthrough());
        this._interceptEvents(runner, this._getEventsToIntercept());

        this._activeBrowserRunners.set(browserId, runner);

        await runner.run(testCollection);

        this._activeBrowserRunners.delete(browserId);
    }

    _getEventsToPassthrough() {
        return _(Events.getRunnerSync()).values().difference(this._getEventsToIntercept()).value();
    }

    _getEventsToIntercept() {
        return _(this._interceptors).map("event").uniq().value();
    }

    _interceptEvents(runner, events) {
        events.forEach(event => {
            runner.on(event, data => {
                try {
                    const toEmit = this._applyInterceptors({ event, data }, this._interceptors);
                    toEmit && toEmit.event && this.emit(toEmit.event, toEmit.data);
                } catch (e) {
                    this.emit(Events.ERROR, e);
                }
            });
        });
    }

    _applyInterceptors({ event, data } = {}, interceptors) {
        const interceptor = _.find(interceptors, { event });
        if (!interceptor) {
            return { event, data };
        }

        return this._applyInterceptors(
            interceptor.handler({ event, data }) || { event, data },
            _.without(interceptors, interceptor),
        );
    }

    cancel() {
        this._cancelled = true;
        this._browserPool.cancel();

        this._activeBrowserRunners.forEach(runner => runner.cancel());
    }

    registerWorkers(workerFilepath, exportedMethods) {
        return this._workersRegistry.register(workerFilepath, exportedMethods);
    }
};
