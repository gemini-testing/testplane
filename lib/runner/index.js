'use strict';

const _ = require('lodash');
const eventsUtils = require('gemini-core').events.utils;
const {temp} = require('gemini-core');

const pool = require('../browser-pool');
const BrowserRunner = require('./browser-runner');
const Events = require('../constants/runner-events');
const Runner = require('./runner');
const RunnerStats = require('../stats');
const RuntimeConfig = require('../config/runtime-config');
const Workers = require('./workers');
const logger = require('../utils/logger');

module.exports = class MainRunner extends Runner {
    constructor(config) {
        super();

        this._config = config;
        this._stats = RunnerStats.create();
        this._browserPool = pool.create(config, this);

        this._activeBrowserRunners = new Set();
        this._workers = null;

        temp.init(this._config.system.tempDir);
        RuntimeConfig.getInstance().extend({tempOpts: temp.serialize()});
    }

    run(testCollection) {
        const workers = Workers.create(this._config);
        this._workers = workers;

        return this.emitAndWait(Events.RUNNER_START, this)
            .then(() => this.emit(Events.BEGIN))
            .then(() => !this._cancelled && this._runTests(testCollection, workers))
            .finally(() => {
                workers.end();

                return this.emitAndWait(Events.RUNNER_END, this._stats.getResult())
                    .catch(logger.warn);
            });
    }

    addTestToRun(test, browserId) {
        if (this._workers === null || this._workers.isEnded() || this._cancelled) {
            return false;
        }

        this._withBrowserRunner(browserId, (runner) => runner.addTestToRun(test));

        return true;
    }

    _runTests(testCollection, workers) {
        return Promise.all(
            testCollection.getBrowsers()
                .map((browserId) => this._runTestsInBrowser(testCollection, browserId, workers))
        );
    }

    async _runTestsInBrowser(testCollection, browserId, workers) {
        await this._withBrowserRunner(browserId, (runner) => runner.run(testCollection, workers));
    }

    async _withBrowserRunner(browserId, fn) {
        let runner = Array.from(this._activeBrowserRunners).find(br => br.browserId === browserId);
        if (runner) {
            await fn(runner);
            return;
        }

        runner = this._createBrowserRunner(browserId);
        this._activeBrowserRunners.add(runner);
        await fn(runner);
        this._activeBrowserRunners.delete(runner);
    }

    _createBrowserRunner(browserId) {
        const runner = BrowserRunner.create(browserId, this._config, this._browserPool);
        eventsUtils.passthroughEvent(runner, this, _.values(Events.getSync()));
        this._stats.attachRunner(runner);

        return runner;
    }

    cancel() {
        this._cancelled = true;
        this._browserPool.cancel();

        this._activeBrowserRunners.forEach((runner) => runner.cancel());
    }
};
