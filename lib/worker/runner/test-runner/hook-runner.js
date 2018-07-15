'use strict';

const Promise = require('bluebird');

module.exports = class HoorRunner {
    static create(...args) {
        return new this(...args);
    }

    constructor(test, executionThread) {
        this._test = test;
        this._executionThread = executionThread;

        this._failedSuite = null;
    }

    async runBeforeEachHooks() {
        await this._runBeforeEachHooks(this._test.parent);
    }

    async _runBeforeEachHooks(suite) {
        if (suite.parent) {
            await this._runBeforeEachHooks(suite.parent);
        }

        try {
            await Promise.mapSeries(suite._beforeEach, (hook) => this._runHook(hook));
        } catch (e) {
            this._failedSuite = suite;
            throw e;
        }
    }

    _runHook(hook) {
        return this._executionThread.run(Object.create(hook));
    }

    async runAfterEachHooks() {
        await this._runAfterEachHooks(this._failedSuite || this._test.parent);
    }

    async _runAfterEachHooks(suite) {
        let error;

        try {
            await Promise.mapSeries(suite._afterEach, (hook) => this._runHook(hook));
        } catch (e) {
            error = e;
        }

        if (suite.parent) {
            try {
                await this._runAfterEachHooks(suite.parent);
            } catch (e) {
                error = error || e;
            }
        }

        if (error) {
            throw error;
        }
    }
};
