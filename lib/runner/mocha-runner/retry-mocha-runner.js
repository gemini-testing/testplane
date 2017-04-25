'use strict';

const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
const RunnerEvents = require('../../constants/runner-events');

module.exports = class RetryMochaRunner extends EventEmitter {
    static create(mocha, retries) {
        return new RetryMochaRunner(mocha, retries);
    }

    constructor(mocha, config) {
        super();

        this._mocha = mocha;
        this._retriesLeft = config.retry;

        this._handleFailEvent(mocha, RunnerEvents.TEST_FAIL);
        this._handleErrorEvent(mocha, RunnerEvents.ERROR);
    }

    _handleFailEvent(mocha, event) {
        mocha.on(event, (failed) => this._handleFail(event, failed));
    }

    _handleFail(event, failed) {
        if (!this._retriesLeft) {
            this.emit(event, failed);
            return;
        }

        this._addTestsToRetry(failed);
        this._emitRetry(failed);
    }

    _handleErrorEvent(mocha, event) {
        mocha.on(event, (err, failed) => this._handleError(event, err, failed));
    }

    _handleError(event, err, failed) {
        if (!failed || !failed.parent || !this._retriesLeft) {
            this.emit(event, err, failed);
            return;
        }

        this._addTestsToRetry(failed.parent);
        this._emitRetry(_.extend(failed, {err}));
    }

    _addTestsToRetry(runnable) {
        if (runnable.type === 'test') {
            this._testsToRetry.push(runnable.fullTitle());
        } else {
            _.union(runnable.suites, runnable.tests).forEach((context) => this._addTestsToRetry(context));
        }
    }

    _emitRetry(failed) {
        this.emit(RunnerEvents.RETRY, _.extend(failed, {retriesLeft: this._retriesLeft - 1}));
    }

    run() {
        this._testsToRetry = [];

        return this._mocha.run()
            .then(() => this._retry());
    }

    _retry() {
        if (_.isEmpty(this._testsToRetry)) {
            return;
        }

        --this._retriesLeft;

        this._mocha
            .reinit()
            .attachTestFilter(this._filterTestsToRetry.bind(this))
            .loadFiles();

        return this.run();
    }

    _filterTestsToRetry(test) {
        return _.some(this._testsToRetry, (fullTitle) => fullTitle === test.fullTitle());
    }
};
