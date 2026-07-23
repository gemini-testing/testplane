"use strict";

const { AsyncEmitter } = require("../../events/async-emitter");
const { passthroughEvent } = require("../../events/utils");
const { WorkerEvents } = require("../../events");
const BrowserPool = require("./browser-pool");
const { BrowserAgent } = require("./browser-agent");
const { CachingTestParser } = require("./caching-test-parser");
const { isRunInNodeJsEnv } = require("../../utils/config");
const {
    runWithTestplaneDependenciesCollecting,
    readTestFileWithTestplaneDependenciesCollecting,
} = require("../../browser/cdp/selectivity/testplane-selectivity");
const ipc = require("../../utils/ipc");
const { TEST_ASSIGNED_TO_WORKER } = require("../../constants/process-messages");
const { selectivityShouldWrite } = require("../../browser/cdp/selectivity/modes");
const { noopProfilerRuntime } = require("../../profiler/runtime/noop");
const { ProfilerSanitizer } = require("../../profiler/sanitize");

module.exports = class Runner extends AsyncEmitter {
    static create(config, profiler) {
        return new Runner(config, profiler);
    }

    constructor(config, profiler) {
        super();

        this._config = config;
        this._profiler = profiler || noopProfilerRuntime;
        this._profilerSanitizer = this._profiler.isEnabled(2) ? new ProfilerSanitizer() : null;
        const isProfiling = profiler?.isEnabled();
        this._browserPool = isProfiling
            ? BrowserPool.create(this._config, this, this._profiler)
            : BrowserPool.create(this._config, this);

        this._testParser = isProfiling ? CachingTestParser.create(config, profiler) : CachingTestParser.create(config);
        passthroughEvent(this._testParser, this, [
            WorkerEvents.BEFORE_FILE_READ,
            WorkerEvents.AFTER_FILE_READ,
            WorkerEvents.AFTER_TESTS_READ,
        ]);
    }

    async runTest(fullTitle, options) {
        const { browserId, file, attempt, attemptId } = options;
        if (!this._profiler.isEnabled()) {
            return this._runTest(fullTitle, options);
        }

        const sessionId = typeof options.profileSessionId === "string" ? options.profileSessionId : undefined;
        const context = {
            ...(attemptId && { attemptId }),
            attempt,
            browserId,
            ...(sessionId && { sessionId }),
            runnableKind: "test",
        };

        try {
            const result = await this._profiler.withContext(context, () =>
                this._profiler.withSpan(
                    "worker.test-attempt",
                    {
                        minLevel: 2,
                        name: fullTitle,
                        context,
                        attributes: {
                            file: this._profilerSanitizer?.path(file) ?? file,
                            browserId,
                            attempt,
                        },
                    },
                    () => this._runTest(fullTitle, options),
                ),
            );
            const profileFragment = this._profiler.takeFragment();
            return profileFragment ? { ...result, profileFragment } : result;
        } catch (error) {
            const profileFragment = this._profiler.takeFragment();
            if (profileFragment && error && (typeof error === "object" || typeof error === "function")) {
                error.profileFragment = profileFragment;
            }
            throw error;
        }
    }

    async _runTest(
        fullTitle,
        {
            browserId,
            browserVersion,
            file,
            sessionId,
            sessionCaps,
            sessionOpts,
            state,
            attempt,
            attemptId,
            profileSessionId,
        },
    ) {
        ipc.emit(TEST_ASSIGNED_TO_WORKER, {
            fullTitle,
            browserId,
            file,
            sessionId,
            workerPid: process.pid,
            ...(attemptId && { attemptId }),
        });

        const browserAgent = BrowserAgent.create({ id: browserId, version: browserVersion, pool: this._browserPool });
        const RunnerClass = isRunInNodeJsEnv(this._config)
            ? await import("./test-runner").then(m => m.default)
            : await import("../browser-env/runner/test-runner").then(m => m.TestRunner);

        const config = this._config.forBrowser(browserId);
        const runner = RunnerClass.create({
            file,
            config,
            browserAgent,
            attempt,
            ...(attemptId && { attemptId }),
            ...(profileSessionId && { profileSessionId }),
            ...(this._profiler.isEnabled() && { profiler: this._profiler }),
        });

        const shouldRecordSelectivityDeps =
            config.selectivity && selectivityShouldWrite(config.selectivity.enabled) && isRunInNodeJsEnv(this._config);

        const prepareParseAndRun = async () => {
            runner.prepareBrowser({ sessionId, sessionCaps, sessionOpts, state });

            const readTestsFn = () => this._testParser.parse({ file, browserId });
            const tests = shouldRecordSelectivityDeps
                ? await readTestFileWithTestplaneDependenciesCollecting(file, readTestsFn)
                : await readTestsFn();

            const test = tests.find(t => t.fullTitle() === fullTitle);

            runner.assignTest(test);

            return runner.run();
        };

        return shouldRecordSelectivityDeps
            ? runWithTestplaneDependenciesCollecting(prepareParseAndRun)
            : prepareParseAndRun();
    }
};
