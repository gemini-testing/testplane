"use strict";

const { promiseMethod, promiseTimeout } = require("../../../utils/promise");
const RuntimeConfig = require("../../../config/runtime-config");
const logger = require("../../../utils/logger");
const { AbortOnReconnectError } = require("../../../errors/abort-on-reconnect-error");
const { captureFailScreenshot } = require("./capture-fail-screenshot");

module.exports = class ExecutionThread {
    static create(...args) {
        return new this(...args);
    }

    constructor({ test, browser, testplaneCtx, attempt }) {
        this._testplaneCtx = testplaneCtx;
        this._browser = browser;
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

        let fnPromise = promiseMethod(runnable.fn).call(this._ctx, this._ctx);

        if (runnable.timeout) {
            const msg = `'${runnable.fullTitle()}' timed out after ${runnable.timeout} ms`;
            fnPromise = promiseTimeout(fnPromise, runnable.timeout, msg);
        }

        let error = null;

        return fnPromise.catch(async e => {
            error = e;

            if (error instanceof AbortOnReconnectError) {
                throw e;
            }

            if (replMode?.onFail) {
                logger.log("Caught error:", e);
                await this._ctx.browser.switchToRepl();
            }

            const { takeScreenshotOnFails } = this._browser.config;
            if (!e.screenshot && takeScreenshotOnFails.testFail) {
                const screenshot = await captureFailScreenshot(this._browser);
                if (screenshot) {
                    e.screenshot = screenshot;
                }
            }
            throw e;
        });
    }

    _setExecutionContext(context) {
        Object.getPrototypeOf(this._ctx.browser).executionContext = context;
    }
};
