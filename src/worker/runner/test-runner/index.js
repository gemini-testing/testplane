/* global document */
"use strict";

const _ = require("lodash");
const HookRunner = require("./hook-runner");
const ExecutionThread = require("./execution-thread");
const OneTimeScreenshooter = require("./one-time-screenshooter");
const { AssertViewError } = require("../../../browser/commands/assert-view/errors/assert-view-error");
const history = require("../../../browser/history");
const { SAVE_HISTORY_MODE } = require("../../../constants/config");
const { filterExtraStackFrames } = require("../../../browser/stacktrace/utils");
const { extendWithCodeSnippet } = require("../../../error-snippets");
const { TestplaneInternalError } = require("../../../errors");

module.exports = class TestRunner {
    static create(...args) {
        return new this(...args);
    }

    constructor({ test, file, config, browserAgent, attempt }) {
        if (test) {
            this._test = test.clone();
            this._test.testplaneCtx = _.cloneDeep(test.testplaneCtx) || {};
        }

        this._file = file;
        this._config = config;
        this._browserAgent = browserAgent;
        this._attempt = attempt;
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
        await this.prepareToRun();

        const error = await this.runRunnables(ExecutionThread);

        return this.finishRun(error);
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

            if (!this._screenshooter) {
                throw new TestplaneInternalError(
                    "OneTimeScreenshooter instance must be initialized before finish test run",
                );
            }

            if (this._screenshooter.getScreenshot()) {
                error.screenshot = this._screenshooter.getScreenshot();
            }
        }

        // we need to check session twice:
        // 1. before afterEach hook to prevent working with broken sessions
        // 2. after collecting all assertView errors (including afterEach section)
        if (!this._browser.state.isBroken && isSessionBroken(error, this._config)) {
            this._browser.markAsBroken();
        }

        testplaneCtx.assertViewResults = assertViewResults ? assertViewResults.toRawObject() : [];

        const { meta } = this._browser;
        const commandsHistory = callstackHistory ? callstackHistory.release() : [];
        const results = {
            testplaneCtx,
            hermioneCtx: testplaneCtx,
            meta,
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

            await extendWithCodeSnippet(error);

            throw Object.assign(error, results);
        }

        return results;
    }

    // TODO: make it protected
    async runRunnables(ExecutionThreadCls) {
        const test = this._test;
        const testplaneCtx = test.testplaneCtx || {};

        this._screenshooter = OneTimeScreenshooter.create(this._config, this._browser);
        const executionThread = ExecutionThreadCls.create({
            test,
            browser: this._browser,
            testplaneCtx,
            hermioneCtx: testplaneCtx,
            screenshooter: this._screenshooter,
            attempt: this._attempt,
        });
        const hookRunner = HookRunner.create(test, executionThread);
        const { callstackHistory } = this._browser;

        let error;

        try {
            const preparePageActions = this._getPreparePageActions(this._browser, history);
            const shouldRunBeforeEach = preparePageActions.length || hookRunner.hasBeforeEachHooks();

            if (shouldRunBeforeEach) {
                await history.runGroup(
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
                );
            }

            await executionThread.run(test);
        } catch (e) {
            error = e;
        }

        if (isSessionBroken(error, this._config)) {
            this._browser.markAsBroken();
        }

        try {
            const needsAfterEach = hookRunner.hasAfterEachHooks();

            if (needsAfterEach) {
                await history.runGroup(
                    {
                        callstack: callstackHistory,
                        snapshotsPromiseRef: this._browser.snapshotsPromiseRef,
                        config: this._config,
                        session: this._browser.publicAPI,
                    },
                    "afterEach",
                    () => hookRunner.runAfterEachHooks(),
                );
            }
        } catch (e) {
            error = error || e;
        } finally {
            // If collecting time travel snapshots takes a lot of time, make it obvious by writing a message
            const collectingSnapshotsMessageTimeout = setTimeout(() => {
                console.log("Collecting Time Travel snapshots takes longer than expected. Waiting...");
            }, 2000);
            await this._browser.snapshotsPromiseRef.current;
            clearTimeout(collectingSnapshotsMessageTimeout);
        }

        return error;
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
