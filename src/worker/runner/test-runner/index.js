/* global document */
"use strict";

const _ = require("lodash");
const HookRunner = require("./hook-runner");
const ExecutionThread = require("./execution-thread");
const { captureFailScreenshot } = require("./capture-fail-screenshot");
const { AssertViewError } = require("../../../browser/commands/assert-view/errors/assert-view-error");
const history = require("../../../browser/history");
const { SAVE_HISTORY_MODE } = require("../../../constants/config");
const { REPL_INSTRUMENTED_FN_FLAG } = require("../../../constants/repl");
const RuntimeConfig = require("../../../config/runtime-config");
const { filterExtraStackFrames } = require("../../../browser/stacktrace/utils");
const { extendWithCodeSnippet } = require("../../../error-snippets");
const { startSelectivity } = require("../../../browser/cdp/selectivity");
const { noopProfilerRuntime } = require("../../../profiler/runtime/noop");

const SNAPSHOTS_TIMEOUT_MS = 10000;
const SNAPSHOTS_WARNING_TIMEOUT_MS = 2000;

module.exports = class TestRunner {
    static create(...args) {
        return new this(...args);
    }

    constructor({
        test,
        file,
        config,
        browserAgent,
        attempt,
        attemptId = /** @type {string | undefined} */ (undefined),
        profileSessionId = /** @type {string | undefined} */ (undefined),
        profiler = /** @type {import("../../../profiler").ProfilerRuntimeLike} */ (noopProfilerRuntime),
    }) {
        if (test) {
            this._test = test.clone();
            this._test.testplaneCtx = _.cloneDeep(test.testplaneCtx) || {};
        }

        this._file = file;
        this._config = config;
        this._browserAgent = browserAgent;
        this._attempt = attempt;
        this._attemptId = attemptId;
        this._profileSessionId = profileSessionId;
        this._profiler = profiler;
    }

    assignTest(test) {
        this._test = test.clone();
        this._test.testplaneCtx = _.cloneDeep(test.testplaneCtx) || {};
    }

    async prepareBrowser({ sessionId, sessionCaps, sessionOpts, state }) {
        this._browserIsSettled = new Promise(resolve => {
            this._browserAgent
                .getBrowser({ sessionId, sessionCaps, sessionOpts, state })
                .then(browser => {
                    this._browser = browser;
                })
                .catch(err => {
                    this._getBrowserException = err;
                })
                .finally(resolve);
        });
    }

    async run() {
        await this._profiler.withSpan(
            "test.prepare",
            { minLevel: 2, name: this._test.fullTitle(), attributes: { stage: "prepare" } },
            () => this.prepareToRun(),
        );

        const stopSelectivity = await this._profiler.withSpan(
            "test.selectivity-start",
            { minLevel: 2, name: this._test.fullTitle() },
            () => startSelectivity(this._browser),
        );

        const error = await this.runRunnables(ExecutionThread);

        await this._profiler.withSpan("test.selectivity-stop", { minLevel: 2, name: this._test.fullTitle() }, () =>
            stopSelectivity(this._test, Boolean(error)),
        );

        return this._profiler.withSpan("test.finish", { minLevel: 2, name: this._test.fullTitle() }, () =>
            this.finishRun(error),
        );
    }

    // TODO: make it protected
    async prepareToRun() {
        await this._browserIsSettled;

        if (!this._test) {
            throw new Error("Test is not assigned");
        }

        if (this._getBrowserException) {
            const testplaneCtx = this._test.testplaneCtx;
            throw Object.assign(this._getBrowserException, { testplaneCtx, hermioneCtx: testplaneCtx });
        }
    }

    // TODO: make it protected
    async finishRun(error) {
        const testplaneCtx = this._test.testplaneCtx;
        const { callstackHistory } = this._browser;

        const assertViewResults = testplaneCtx.assertViewResults;
        if (!error && assertViewResults && assertViewResults.hasFails()) {
            error = new AssertViewError();

            if (this._config.takeScreenshotOnFails.assertViewFail) {
                const screenshot = await captureFailScreenshot(this._browser);
                if (screenshot) {
                    error.screenshot = screenshot;
                }
            }
        }

        // we need to check session twice:
        // 1. before afterEach hook to prevent working with broken sessions
        // 2. after collecting all assertView errors (including afterEach section)
        if (!this._browser.state.isBroken && isSessionBroken(error, this._config)) {
            this._browser.markAsBroken({ stubBrowserCommands: true });
        }

        testplaneCtx.assertViewResults = assertViewResults ? assertViewResults.toRawObject() : [];

        const { meta, tags } = this._browser;

        const commandsHistory = callstackHistory ? callstackHistory.release() : [];
        const results = {
            testplaneCtx,
            hermioneCtx: testplaneCtx,
            meta,
            tags,
        };

        switch (this._browser.config.saveHistoryMode) {
            case SAVE_HISTORY_MODE.ALL:
            case error && SAVE_HISTORY_MODE.ONLY_FAILED:
                results.history = commandsHistory;
                break;
        }

        if (error && this._browser.state) {
            this._browser.state.isLastTestFailed = true;
        }

        this._browserAgent.freeBrowser(this._browser);

        if (error) {
            filterExtraStackFrames(error);

            let current = error.cause;
            let depth = 1;

            // Propagate errors from the cause into the stack trace of the main error.
            while (current) {
                const indent = "    ".repeat(depth);
                error.stack += `\n\n${indent}Caused by: ${current.stack.split("\n").join(`\n${indent}`)}`;

                current = current.cause;

                depth++;
            }

            // The original cause must be removed to avoid possible duplicates later.
            delete error.cause;

            await extendWithCodeSnippet(error);

            throw Object.assign(error, results);
        }

        return results;
    }

    // TODO: make it protected
    async runRunnables(ExecutionThreadCls) {
        const test = this._test;
        const testplaneCtx = test.testplaneCtx || {};

        const executionThread = ExecutionThreadCls.create({
            test,
            browser: this._browser,
            testplaneCtx,
            hermioneCtx: testplaneCtx,
            attempt: this._attempt,
            attemptId: this._attemptId,
            profileSessionId: this._profileSessionId,
            profiler: this._profiler,
        });
        const hookRunner = HookRunner.create(test, executionThread);
        const { callstackHistory } = this._browser;

        let error;

        try {
            const preparePageActions = this._getPreparePageActions(this._browser, history);
            const shouldRunBeforeEach = preparePageActions.length || hookRunner.hasBeforeEachHooks();

            if (shouldRunBeforeEach) {
                await this._profiler.withSpan("test.beforeEach.total", { minLevel: 2, name: test.fullTitle() }, () =>
                    history.runGroup(
                        {
                            callstack: callstackHistory,
                            snapshotsPromiseRef: this._browser.snapshotsPromiseRef,
                            config: this._config,
                            session: this._browser.publicAPI,
                        },
                        "beforeEach",
                        async () => {
                            for (const action of preparePageActions) {
                                await action();
                            }

                            await hookRunner.runBeforeEachHooks();
                        },
                    ),
                );
            }

            await this._profiler.withSpan("test.body", { minLevel: 2, name: test.fullTitle() }, async () => {
                await this._runReplBeforeTestIfNeeded(test, executionThread);
                await executionThread.run(test, { kind: "test" });
            });
        } catch (e) {
            error = e;
        }

        if (isSessionBroken(error, this._config)) {
            this._browser.markAsBroken({ stubBrowserCommands: true });
        }

        try {
            const needsAfterEach = hookRunner.hasAfterEachHooks();

            if (needsAfterEach) {
                await this._profiler.withSpan("test.afterEach.total", { minLevel: 2, name: test.fullTitle() }, () =>
                    history.runGroup(
                        {
                            callstack: callstackHistory,
                            snapshotsPromiseRef: this._browser.snapshotsPromiseRef,
                            config: this._config,
                            session: this._browser.publicAPI,
                        },
                        "afterEach",
                        () => hookRunner.runAfterEachHooks(),
                    ),
                );
            }
        } catch (e) {
            error = error || e;
        } finally {
            history.requestDomSnapshots({
                callstack: callstackHistory,
                snapshotsPromiseRef: this._browser.snapshotsPromiseRef,
                config: this._config,
                session: this._browser.publicAPI,
                currentTest: test,
                attempt: this._attempt,
            });

            const snapshotsTimeout = new Promise((_, reject) =>
                setTimeout(() => {
                    this._browser.markAsBroken({ stubBrowserCommands: true });
                    reject(new Error(`Collecting Time Travel snapshots timed out after ${SNAPSHOTS_TIMEOUT_MS}ms`));
                }, SNAPSHOTS_TIMEOUT_MS),
            );

            // If collecting time travel snapshots takes a lot of time, make it obvious by writing a message
            const collectingSnapshotsMessageTimeout = setTimeout(() => {
                console.log("Collecting Time Travel snapshots takes longer than expected. Waiting...");
            }, SNAPSHOTS_WARNING_TIMEOUT_MS);

            await this._profiler.withSpan(
                "test.snapshots-cleanup",
                { minLevel: 2, name: test.fullTitle() },
                async () => {
                    try {
                        await Promise.race([this._browser.snapshotsPromiseRef.current, snapshotsTimeout]);
                    } catch (e) {
                        console.error(e.message);
                    } finally {
                        clearTimeout(collectingSnapshotsMessageTimeout);
                        await history.cleanupDomSnapshots({
                            callstack: callstackHistory,
                            session: this._browser.publicAPI,
                        });
                    }
                },
            );
        }

        return error;
    }

    async _runReplBeforeTestIfNeeded(test, executionThread) {
        const { replMode } = RuntimeConfig.getInstance();

        // REPL_INSTRUMENTED_FN_FLAG means that we already embedded the switchToRepl call into source via transform,
        // so we don't need to run it again here. However, if typescript was not available, we need to run it here.
        if (replMode?.beforeTest && !test.fn[REPL_INSTRUMENTED_FN_FLAG]) {
            await executionThread.run(
                Object.create(test, {
                    timeout: {
                        value: 0,
                    },
                    fn: {
                        value: () => this._browser.publicAPI.switchToRepl(),
                    },
                }),
                { kind: "prepare" },
            );
        }
    }

    _getPreparePageActions(browser, history) {
        if (!browser.config.resetCursor) {
            return [];
        }

        const fn = async () => {
            // TODO: make it on browser.init when "actions" method will be implemented in all webdrivers
            await history.runGroup(
                {
                    callstack: browser.callstackHistory,
                    snapshotsPromiseRef: this._browser.snapshotsPromiseRef,
                    config: this._config,
                    session: this._browser.publicAPI,
                },
                "resetCursor",
                () => this._resetCursorPosition(browser),
            );
        };

        return [fn];
    }

    async _resetCursorPosition({ publicAPI: session }) {
        const body = await session.$("body");
        if (!body) {
            throw new Error('There is no "body" element on the page when resetting cursor position');
        }

        await body.scrollIntoView();

        if (!session.isW3C) {
            const { x = 0, y = 0 } = await session.execute(function () {
                return document.body.getBoundingClientRect();
            });

            return session.moveToElement(body.elementId, -Math.floor(x), -Math.floor(y));
        }

        await session
            .action("pointer", { parameters: { pointerType: "mouse" } })
            .move({ x: 0, y: 0 })
            .perform();
    }
};

function isSessionBroken(error, { system: { patternsOnReject } }) {
    return error && patternsOnReject.some(p => new RegExp(p).test(error.message));
}
