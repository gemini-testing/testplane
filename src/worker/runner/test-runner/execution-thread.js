"use strict";

const Promise = require("bluebird");
const RuntimeConfig = require("../../../config/runtime-config");
const logger = require("../../../utils/logger");
const { AbortOnReconnectError } = require("../../../errors/abort-on-reconnect-error");

module.exports = class ExecutionThread {
    static create(...args) {
        return new this(...args);
    }

    constructor({ test, browser, testplaneCtx, screenshooter, attempt }) {
        this._testplaneCtx = testplaneCtx;
        this._screenshooter = screenshooter;
        this._ctx = {
            browser: browser.publicAPI,
            currentTest: test,
            attempt,
        };

        this._runtimeConfig = RuntimeConfig.getInstance();
        this._isReplBeforeTestOpened = false;
    }

    async run(runnable) {
        this._setExecutionContext(
            Object.assign(runnable, {
                testplaneCtx: this._testplaneCtx,
                hermioneCtx: this._testplaneCtx,
                ctx: this._ctx,
            }),
        );

        try {
            await this._call(runnable);
        } catch (err) {
            this._ctx.currentTest.err = this._ctx.currentTest.err || err;

            throw err;
        } finally {
            this._setExecutionContext(null);
        }
    }

    async _call(runnable) {
        const { replMode } = this._runtimeConfig;

        if (replMode?.beforeTest && !this._isReplBeforeTestOpened) {
            await this._ctx.browser.switchToRepl();
            this._isReplBeforeTestOpened = true;
        }

        let fnPromise = Promise.method(runnable.fn).call(this._ctx, this._ctx);

        if (runnable.timeout) {
            const msg = `'${runnable.fullTitle()}' timed out after ${runnable.timeout} ms`;
            fnPromise = fnPromise.timeout(runnable.timeout, msg);
        }

        let error = null;

        return fnPromise
            .tapCatch(async e => {
                error = e;

                if (error instanceof AbortOnReconnectError) {
                    return;
                }

                if (replMode?.onFail) {
                    logger.log("Caught error:", e);
                    await this._ctx.browser.switchToRepl();
                }

                return this._screenshooter.extendWithScreenshot(e);
            })
            .finally(async () => {
                if (error instanceof AbortOnReconnectError) {
                    return;
                }

                if (this._testplaneCtx.assertViewResults && this._testplaneCtx.assertViewResults.hasFails()) {
                    await this._screenshooter.captureScreenshotOnAssertViewFail();
                }
            });
    }

    _setExecutionContext(context) {
        Object.getPrototypeOf(this._ctx.browser).executionContext = context;
    }
};
