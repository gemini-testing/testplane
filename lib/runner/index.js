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
const PromiseGroup = require('./promise-group');
const TestCollection = require('../test-collection');
const logger = require('../utils/logger');

module.exports = class MainRunner extends Runner {
    constructor(config) {
        super();

        this._config = config;
        this._stats = RunnerStats.create();
        this._browserPool = pool.create(config, this);

        this._activeBrowserRunners = new Set();
        this._workers = null;
        this._running = new PromiseGroup();

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
        if (this._workers === null || this._workers.isEnded() || this._cancelled || this._running.isFulfilled()) {
            return false;
        }

        const runner = Array.from(this._activeBrowserRunners).find(br => br.browserId() === browserId);
        if (runner && runner.addTestToRun(test)) {
            return true;
        }

        const collection = TestCollection.create({[browserId]: [test]});
        this._running.add(this._runTestsInBrowser(collection, browserId, this._workers));

        return true;
    }

    _runTests(testCollection, workers) {
        testCollection.getBrowsers().forEach((browserId) => {
            this._running.add(this._runTestsInBrowser(testCollection, browserId, workers));
        });

        return this._running.done();
    }

    async _runTestsInBrowser(testCollection, browserId, workers) {
        const runner = BrowserRunner.create(browserId, this._config, this._browserPool);

        eventsUtils.passthroughEvent(runner, this, _.values(Events.getSync()));
        this._stats.attachRunner(runner);

        this._activeBrowserRunners.add(runner);

        await runner.run(testCollection, workers);

        this._activeBrowserRunners.delete(runner);
    }

    cancel() {
        this._cancelled = true;
        this._browserPool.cancel();

        this._activeBrowserRunners.forEach((runner) => runner.cancel());
    }
};
