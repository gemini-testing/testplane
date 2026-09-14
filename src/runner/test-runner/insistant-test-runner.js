"use strict";

const _ = require("lodash");

const { RunnableEmitter } = require("../types");
const RegularTestRunner = require("./regular-test-runner");
const HighPriorityBrowserAgent = require("./high-priority-browser-agent");
const { MasterEvents } = require("../../events");
const { passthroughEvent } = require("../../events/utils");
const { NoRefImageError } = require("../../browser/commands/assert-view/errors/no-ref-image-error");

module.exports = class InsistantTestRunner extends RunnableEmitter {
    constructor(test, config, browserAgent, profiler) {
        super();

        this._test = test;
        this._config = config;
        this._browserConfig = config.forBrowser(browserAgent.browserId);
        this._browserAgent = browserAgent;
        this._profiler = profiler;

        this._retriesPerformed = 0;
        this._cancelled = false;
        this._cancelError = null;
        this._activeRunner = null;
    }

    async run(workers) {
        let retry = false;

        const browserAgent =
            this._retriesPerformed > 0 ? HighPriorityBrowserAgent.create(this._browserAgent) : this._browserAgent;

        const runner = RegularTestRunner.create(this._test, browserAgent, this._profiler).on(
            MasterEvents.TEST_FAIL,
            data => {
                if (this._shouldRetry(data)) {
                    this.emit(MasterEvents.RETRY, _.extend(data, { retriesLeft: this._retriesLeft }));
                    retry = true;
                } else {
                    this.emit(MasterEvents.TEST_FAIL, data);
                }
            },
        );
        this._activeRunner = runner;

        if (this._cancelError) {
            runner.cancel(this._cancelError);
        }

        passthroughEvent(runner, this, [MasterEvents.TEST_BEGIN, MasterEvents.TEST_PASS, MasterEvents.TEST_END]);

        await runner.run(workers, this._retriesPerformed);
        this._activeRunner = null;

        if (retry) {
            ++this._retriesPerformed;
            await this.run(workers);
        }
    }

    _shouldRetry(test) {
        if (this._cancelled) {
            return false;
        }

        if (typeof this._browserConfig.shouldRetry === "function") {
            return Boolean(
                this._browserConfig.shouldRetry({
                    ctx: test,
                    retriesLeft: this._retriesLeft,
                }),
            );
        }

        // TODO: replace with `instanceof AssertViewError` check
        // when errors will be correctly restored after transfer from workers
        if (test.err.name === "AssertViewError" && test.assertViewResults.some(e => e instanceof NoRefImageError)) {
            return false;
        }

        return this._retriesLeft > 0;
    }

    get _retriesLeft() {
        return this._browserConfig.retry - this._retriesPerformed;
    }

    cancel(error) {
        this._cancelled = true;
        this._cancelError = this._cancelError || error;
        this._activeRunner?.cancel(error);
    }
};
