'use strict';

const Promise = require('bluebird');

module.exports = class ExecutionThread {
    static create(...args) {
        return new this(...args);
    }

    constructor({test, browser, hermioneCtx, screenshooter}) {
        this._hermioneCtx = hermioneCtx;
        this._screenshooter = screenshooter;

        this._ctx = {
            browser: browser.publicAPI,
            currentTest: test
        };
    }

    async run(runnable) {
        this._setExecutionContext(Object.assign(runnable, {
            hermioneCtx: this._hermioneCtx,
            ctx: this._ctx
        }));

        let error;
        try {
            await this._call(runnable);
        } catch (e) {
            error = e;
        }

        this._setExecutionContext(null);

        if (error) {
            const test = this._ctx.currentTest;
            if (!test.err) {
                test.err = error;
            }

            throw error;
        }
    }

    _call(runnable) {
        let fnPromise = Promise.method(runnable.fn).apply(this._ctx);

        if (runnable.enableTimeouts() && runnable.timeout()) {
            const msg = `${runnable.type} '${runnable.fullTitle()}' timed out after ${runnable.timeout()} ms`;
            fnPromise = fnPromise.timeout(runnable.timeout(), msg);
        }

        return fnPromise.tapCatch((e) => this._screenshooter.extendWithPageScreenshot(e));
    }

    _setExecutionContext(context) {
        Object.getPrototypeOf(this._ctx.browser).executionContext = context;
    }
};
