"use strict";

const { promiseMethod, promiseTimeout } = require("../../../utils/promise");
const RuntimeConfig = require("../../../config/runtime-config");
const logger = require("../../../utils/logger");
const { AbortOnReconnectError } = require("../../../errors/abort-on-reconnect-error");
const { captureFailScreenshot } = require("./capture-fail-screenshot");
const { noopProfilerRuntime } = require("../../../profiler/runtime/noop");
const { ProfilerSanitizer } = require("../../../profiler/sanitize");

let profilerSanitizer;

module.exports = class ExecutionThread {
    static create(...args) {
        return new this(...args);
    }

    constructor({
        test,
        browser,
        testplaneCtx,
        attempt,
        attemptId = /** @type {string | undefined} */ (undefined),
        profileSessionId = /** @type {string | undefined} */ (undefined),
        profiler = /** @type {import("../../../profiler").ProfilerRuntimeLike} */ (noopProfilerRuntime),
    }) {
        this._testplaneCtx = testplaneCtx;
        this._browser = browser;
        this._ctx = {
            browser: browser.publicAPI,
            currentTest: test,
            attempt,
        };

        this._runtimeConfig = RuntimeConfig.getInstance();
        this._profiler = profiler;
        this._attemptId = attemptId;
        this._profileSessionId = profileSessionId;
        this._runnableKind = "test";
        this._profileHookSource = profiler.isEnabled?.(2) ?? false;
    }

    async run(runnable, meta = { kind: "test" }) {
        this._runnableKind = meta.kind;
        const execute = () => this._profiler.withContext({ runnableKind: meta.kind }, () => this._run(runnable));
        if (meta.kind === "beforeEach" || meta.kind === "afterEach") {
            return this._profiler.withSpan(
                "test.hook",
                {
                    minLevel: 2,
                    name: runnable.fullTitle(),
                    context: { runnableKind: meta.kind },
                    source: this._hookSource(runnable),
                    attributes: { hook: meta.kind },
                },
                execute,
            );
        }

        return execute();
    }

    _hookSource(runnable) {
        if (!this._profileHookSource) {
            return;
        }

        profilerSanitizer ??= new ProfilerSanitizer();
        return {
            file: profilerSanitizer.path(runnable.file),
            line: runnable.location?.line,
            column: runnable.location?.column,
            functionName: runnable.fn?.name || undefined,
            confidence: runnable.location ? "high" : "medium",
        };
    }

    async _run(runnable) {
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
