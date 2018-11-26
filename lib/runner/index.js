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
    constructor(config, interceptors) {
        super();

        this._config = config;
        this._interceptors = interceptors;
        this._stats = RunnerStats.create();
        this._browserPool = pool.create(config, this);

        this._activeBrowserRunners = new Set();

        temp.init(this._config.system.tempDir);
        RuntimeConfig.getInstance().extend({tempOpts: temp.serialize()});
    }

    run(testCollection) {
        const workers = Workers.create(this._config);

        return this.emitAndWait(Events.RUNNER_START, this)
            .then(() => this.emit(Events.BEGIN))
            .then(() => !this._cancelled && this._runTests(testCollection, workers))
            .finally(() => {
                workers.end();

                return this.emitAndWait(Events.RUNNER_END, this._stats.getResult())
                    .catch(logger.warn);
            });
    }

    _runTests(testCollection, workers) {
        return Promise.all(
            testCollection.getBrowsers()
                .map((browserId) => this._runTestsInBrowser(testCollection, browserId, workers))
        );
    }

    async _runTestsInBrowser(testCollection, browserId, workers) {
        const runner = BrowserRunner.create(browserId, this._config, this._browserPool);

        eventsUtils.passthroughEvent(runner, this, this._getEventsToPassthrough());
        this._interceptEvents(runner, this._getEventsToIntercept());
        this._stats.attachRunner(runner);

        this._activeBrowserRunners.add(runner);

        await runner.run(testCollection, workers);

        this._activeBrowserRunners.delete(runner);
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
                    this.emit(...this._applyInterceptors({event, data}, this._interceptors));
                } catch (e) {
                    this.emit(Events.ERROR, e);
                }
            });
        });
    }

    _applyInterceptors({event, data} = {}, interceptors) {
        const interceptor = _.find(interceptors, ['event', event]);
        if (!interceptor) {
            return [event, data];
        }

        return this._applyInterceptors(interceptor.handler({event, data}) || {event, data}, _.without(interceptors, interceptor));
    }

    cancel() {
        this._cancelled = true;
        this._browserPool.cancel();

        this._activeBrowserRunners.forEach((runner) => runner.cancel());
    }
};
