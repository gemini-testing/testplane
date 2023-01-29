"use strict";

const Promise = require("bluebird");

module.exports = class ExecutionThread {
    static create(...args) {
        return new this(...args);
    }

    constructor({ test, browser, hermioneCtx, screenshooter }) {
        this._hermioneCtx = hermioneCtx;
        this._screenshooter = screenshooter;
        this._ctx = {
            browser: browser.publicAPI,
            currentTest: test,
        };
    }

    async run(runnable) {
        this._setExecutionContext(Object.assign(runnable, {
            hermioneCtx: this._hermioneCtx,
            ctx: this._ctx,
        }));

        try {
            await this._call(runnable);
        } catch (err) {
            this._ctx.currentTest.err = this._ctx.currentTest.err || err;

            throw err;
        } finally {
            this._setExecutionContext(null);
        }
    }

    _call(runnable) {
        let fnPromise = Promise.method(runnable.fn).call(this._ctx, this._ctx);

        if (runnable.timeout) {
            const msg = `${runnable.type} '${runnable.fullTitle()}' timed out after ${runnable.timeout} ms`;
            fnPromise = fnPromise.timeout(runnable.timeout, msg);
        }

        return fnPromise
            .tapCatch((e) => this._screenshooter.extendWithScreenshot(e))
            .finally(async () => {
                if (this._hermioneCtx.assertViewResults && this._hermioneCtx.assertViewResults.hasFails()) {
                    await this._screenshooter.captureScreenshotOnAssertViewFail();
                }
            });
    }

    _setExecutionContext(context) {
        Object.getPrototypeOf(this._ctx.browser).executionContext = context;
    }
};
