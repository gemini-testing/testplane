'use strict';

const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
const RunnerEvents = require('../../constants/runner-events');
const NoRefImageError = require('../../browser/commands/assert-view/errors/no-ref-image-error');

module.exports = class RetryMochaRunner extends EventEmitter {
    static create(mocha, config) {
        return new RetryMochaRunner(mocha, config);
    }

    constructor(mocha, config) {
        super();

        this._mocha = mocha;
        this._config = config;
        this._retriesPerformed = 0;

        this._handleFailEvent(mocha, RunnerEvents.TEST_FAIL);
        this._handleErrorEvent(mocha, RunnerEvents.ERROR);
    }

    _handleFailEvent(mocha, event) {
        mocha.on(event, (failed) => this._handleFail(event, failed));
    }

    _handleFail(event, failed) {
        if (!this._shouldRetry(failed)) {
            this.emit(event, failed);
            return;
        }

        this._emitRetry(failed);
    }

    _handleErrorEvent(mocha, event) {
        mocha.on(event, (err, failed) => this._handleError(event, err, failed));
    }

    _handleError(event, err, failed) {
        if (!failed || !failed.parent || !this._shouldRetry(failed, err)) {
            this.emit(event, err, failed);
            return;
        }

        this._emitRetry(_.extend(failed, {err}));
    }

    _emitRetry(failed) {
        this._retryFlag = true;
        this.emit(RunnerEvents.RETRY, _.extend(failed, {retriesLeft: this._retriesLeft - 1}));
    }

    run(workers) {
        this._retryFlag = false;

        return this._mocha.run(workers)
            .then(() => this._retry(workers));
    }

    _retry(workers) {
        if (!this._retryFlag) {
            return;
        }

        ++this._retriesPerformed;
        this._mocha.reinit();
        return this.run(workers);
    }

    _shouldRetry(data, error) {
        if (typeof this._config.shouldRetry === 'function') {
            return Boolean(this._config.shouldRetry({
                ctx: data,
                retriesLeft: this._retriesLeft,
                error
            }));
        }

        return this._hasNoRefImageError(data)
            ? false
            : this._retriesLeft > 0;
    }

    _hasNoRefImageError({assertViewResults = []} = {}) {
        return assertViewResults.some((res) => res instanceof NoRefImageError);
    }

    get _retriesLeft() {
        return this._config.retry - this._retriesPerformed;
    }
};
