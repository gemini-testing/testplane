"use strict";
const Promise = require("bluebird");
module.exports = class HookRunner {
    static create(...args) {
        return new this(...args);
    }
    constructor(test, executionThread) {
        this._test = test;
        this._executionThread = executionThread;
        this._failedSuite = null;
    }
    hasBeforeEachHooks() {
        const suite = this._test.parent;
        return hasHooks(suite, "beforeEach");
    }
    async runBeforeEachHooks() {
        await this._runBeforeEachHooks(this._test.parent);
    }
    async _runBeforeEachHooks(suite) {
        if (suite.parent) {
            await this._runBeforeEachHooks(suite.parent);
        }
        try {
            await Promise.mapSeries(suite.beforeEachHooks, hook => this._runHook(hook));
        }
        catch (e) {
            this._failedSuite = suite;
            throw e;
        }
    }
    _runHook(hook) {
        return this._executionThread.run(hook.clone());
    }
    hasAfterEachHooks() {
        const suite = this._failedSuite || this._test.parent;
        return hasHooks(suite, "afterEach");
    }
    async runAfterEachHooks() {
        await this._runAfterEachHooks(this._failedSuite || this._test.parent);
    }
    async _runAfterEachHooks(suite) {
        let error;
        try {
            await Promise.mapSeries(suite.afterEachHooks, hook => this._runHook(hook));
        }
        catch (e) {
            error = e;
        }
        if (suite.parent) {
            try {
                await this._runAfterEachHooks(suite.parent);
            }
            catch (e) {
                error = error || e;
            }
        }
        if (error) {
            throw error;
        }
    }
};
function hasHooks(suite, hookType) {
    return suite && (suite[`${hookType}Hooks`].length || hasHooks(suite.parent, hookType));
}
//# sourceMappingURL=hook-runner.js.map