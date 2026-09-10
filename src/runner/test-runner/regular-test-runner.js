"use strict";

const crypto = require("crypto");
const _ = require("lodash");
const { RunnableEmitter } = require("../types");
const logger = require("../../utils/logger");
const { MasterEvents } = require("../../events");
const AssertViewResults = require("../../browser/commands/assert-view/assert-view-results");
const RuntimeConfig = require("../../config/runtime-config");
const { noopProfilerRuntime } = require("../../profiler/runtime/noop");
const { ProfilerSanitizer } = require("../../profiler/sanitize");

module.exports = class RegularTestRunner extends RunnableEmitter {
    constructor(test, browserAgent, profiler) {
        super();

        this._test = test.clone();
        this._browserAgent = browserAgent;
        this._browser = null;
        this._profiler = profiler || noopProfilerRuntime;
        this._profilerSanitizer = this._profiler.isEnabled(2) ? new ProfilerSanitizer() : null;
    }

    async run(workers, retriesPerformed) {
        if (!this._profiler.isEnabled(2)) {
            return this._run(workers, retriesPerformed);
        }

        const attemptId = crypto.randomUUID();
        const context = {
            attemptId,
            attempt: retriesPerformed,
            testId: this._test.id,
            browserId: this._browserAgent.browserId,
            runnableKind: "test",
        };

        return this._profiler.withContext(context, () =>
            this._profiler.withSpan(
                "test.attempt",
                {
                    minLevel: 2,
                    name: this._test.fullTitle(),
                    context,
                    attributes: {
                        file: this._profilerSanitizer?.path(this._test.file) ?? this._test.file,
                        browserId: this._browserAgent.browserId,
                        attempt: retriesPerformed,
                    },
                },
                () => this._run(workers, retriesPerformed, attemptId),
            ),
        );
    }

    async _run(workers, retriesPerformed, attemptId) {
        let freeBrowserPromise;

        try {
            const browser = await this._profiler.withSpan(
                "browser.session.acquire",
                { minLevel: 2, name: this._browserAgent.browserId },
                () => this._getBrowser(),
            );

            if (browser) {
                workers.once(`worker.${browser.sessionId}.freeBrowser`, browserState => {
                    freeBrowserPromise = this._freeBrowser(browserState);
                });
            }

            this._emit(MasterEvents.TEST_BEGIN);

            this._test.startTime = Date.now();

            const sessionId = this._profileSessionId(browser?.sessionId);
            const results = await this._profiler.withContext(sessionId ? { sessionId } : {}, () =>
                this._profiler.withSpan("worker.execution", { minLevel: 2, name: this._test.fullTitle() }, () =>
                    this._runTest(workers, retriesPerformed, attemptId, sessionId),
                ),
            );
            this._profiler.withSpan("test.result-processing", { minLevel: 2, name: this._test.fullTitle() }, () =>
                this._applyTestResults(results),
            );

            this._emit(MasterEvents.TEST_PASS);
        } catch (error) {
            this._test.err = this._browser?.exitError || error;

            this._applyTestResults(this._test.err);

            this._emit(MasterEvents.TEST_FAIL);
        }

        this._emit(MasterEvents.TEST_END);

        await this._profiler.withSpan(
            "browser.session.release",
            { minLevel: 2, name: this._browserAgent.browserId },
            () => freeBrowserPromise || this._freeBrowser(),
        );
    }

    _emit(event) {
        this.emit(event, this._test);
    }

    async _runTest(workers, attempt, attemptId, profileSessionId) {
        if (!this._browser) {
            throw this._test.err;
        }

        try {
            const result = await workers.runTest(this._test.fullTitle(), {
                browserId: this._browser.id,
                browserVersion: this._browser.version,
                sessionId: this._browser.sessionId,
                sessionCaps: this._browser.capabilities,
                sessionOpts: this._browser.publicAPI.options,
                file: this._test.file,
                state: this._browser.state,
                attempt,
                ...(attemptId && { attemptId }),
                ...(profileSessionId && { profileSessionId }),
            });
            this._ingestProfileFragment(result);
            return result;
        } catch (error) {
            this._ingestProfileFragment(error);
            throw error;
        }
    }

    _ingestProfileFragment(container) {
        const fragment = container && container.profileFragment;
        if (!fragment) {
            return;
        }

        this._profiler.ingestFragment(fragment);
        try {
            delete container.profileFragment;
        } catch {
            // The fragment is internal; a frozen worker error can safely keep it until serialization ends.
        }
    }

    _applyTestResults({ tags, meta, testplaneCtx = {}, history = [] }) {
        testplaneCtx.assertViewResults = AssertViewResults.fromRawObject(testplaneCtx.assertViewResults || []);
        this._test.assertViewResults = testplaneCtx.assertViewResults.get();

        this._test.meta = _.extend(this._test.meta, meta);
        this._test.testplaneCtx = testplaneCtx;
        this._test.hermioneCtx = testplaneCtx;
        this._test.history = history;

        if (tags) {
            tags.forEach(tag => this._test.addTag(tag));
        }

        this._test.duration = Date.now() - this._test.startTime;
    }

    _getTraceparent() {
        const version = "00";
        const traceId = crypto.randomBytes(16).toString("hex");
        const parentId = "00" + crypto.randomBytes(7).toString("hex");
        const traceFlag = "01";

        return `${version}-${traceId}-${parentId}-${traceFlag}`;
    }

    _profileSessionId(sessionId) {
        if (!this._profiler.isEnabled(2) || typeof sessionId !== "string") {
            return;
        }

        return `session-${crypto
            .createHash("sha256")
            .update(`${this._profiler.runId}\0${sessionId}`)
            .digest("hex")
            .slice(0, 12)}`;
    }

    async _getBrowser() {
        try {
            const state = {
                testXReqId: crypto.randomUUID(),
                traceparent: this._getTraceparent(),
            };

            this._browser = await this._browserAgent.getBrowser({ state });

            // TODO: move logic to caching pool (in order to use correct state for cached browsers)
            if (
                this._browser.state.testXReqId !== state.testXReqId ||
                this._browser.state.traceparent !== state.traceparent
            ) {
                this._browser.applyState(state);
            }

            this._test.sessionId = this._browser.sessionId;

            return this._browser;
        } catch (error) {
            this._test.err = error;
        }
    }

    async _freeBrowser(browserState = {}) {
        if (!this._browser) {
            return;
        }

        const runtimeConfig = RuntimeConfig.getInstance();
        const keepBrowserMode = runtimeConfig.keepBrowserMode;

        if (keepBrowserMode?.enabled) {
            const hasError = !!this._test.err || !!browserState?.isLastTestFailed;
            const shouldKeep = keepBrowserMode.onFail ? hasError : true;

            if (shouldKeep) {
                this._logKeepBrowserInfo();
                return;
            }
        }

        const browser = this._browser;
        this._browser = null;

        browser.applyState(browserState);

        try {
            await this._browserAgent.freeBrowser(browser);
        } catch (error) {
            logger.warn(`WARNING: can not release browser: ${error}`);
        }
    }

    _logKeepBrowserInfo() {
        if (!this._browser) {
            return;
        }

        logger.log(
            "Testplane run has finished, but the browser won't be closed, because you passed the --keep-browser argument.",
        );
        logger.log("You may attach to this browser using the following capabilities:");
        logger.log(
            JSON.stringify(
                {
                    sessionId: this._browser.sessionId,
                    sessionCaps: this._browser.capabilities,
                    sessionOpts: this._browser.publicAPI.options,
                    driverPid: this._browser.getDriverPid(),
                },
                null,
                2,
            ),
        );
    }
};
