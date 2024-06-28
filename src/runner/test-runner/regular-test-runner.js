"use strict";

const crypto = require("crypto");
const _ = require("lodash");
const { Runner } = require("../runner");
const logger = require("../../utils/logger");
const { MasterEvents } = require("../../events");
const AssertViewResults = require("../../browser/commands/assert-view/assert-view-results");

module.exports = class RegularTestRunner extends Runner {
    constructor(test, browserAgent) {
        super();

        this._test = test.clone();
        this._browserAgent = browserAgent;
        this._browser = null;
    }

    async run(workers) {
        let freeBrowserPromise;

        try {
            const browser = await this._getBrowser();

            if (browser) {
                workers.once(`worker.${browser.sessionId}.freeBrowser`, browserState => {
                    freeBrowserPromise = this._freeBrowser(browserState);
                });
            }

            this._emit(MasterEvents.TEST_BEGIN);

            this._test.startTime = Date.now();

            const results = await this._runTest(workers);
            this._applyTestResults(results);

            this._emit(MasterEvents.TEST_PASS);
        } catch (error) {
            this._test.err = error;

            this._applyTestResults(error);

            this._emit(MasterEvents.TEST_FAIL);
        }

        this._emit(MasterEvents.TEST_END);

        await (freeBrowserPromise || this._freeBrowser());
    }

    _emit(event) {
        this.emit(event, this._test);
    }

    async _runTest(workers) {
        if (!this._browser) {
            throw this._test.err;
        }

        return await workers.runTest(this._test.fullTitle(), {
            browserId: this._browser.id,
            browserVersion: this._browser.version,
            sessionId: this._browser.sessionId,
            sessionCaps: this._browser.capabilities,
            sessionOpts: this._browser.publicAPI.options,
            file: this._test.file,
            state: this._browser.state,
        });
    }

    _applyTestResults({ meta, testplaneCtx = {}, history = [] }) {
        testplaneCtx.assertViewResults = AssertViewResults.fromRawObject(testplaneCtx.assertViewResults || []);
        this._test.assertViewResults = testplaneCtx.assertViewResults.get();

        this._test.meta = _.extend(this._test.meta, meta);
        this._test.testplaneCtx = testplaneCtx;
        this._test.hermioneCtx = testplaneCtx;
        this._test.history = history;

        this._test.duration = Date.now() - this._test.startTime;
    }

    _getTraceparent() {
        const version = "00";
        const traceId = crypto.randomBytes(16).toString("hex");
        const parentId = "00" + crypto.randomBytes(7).toString("hex");
        const traceFlag = "01";

        return `${version}-${traceId}-${parentId}-${traceFlag}`;
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

        const browser = this._browser;
        this._browser = null;

        browser.applyState(browserState);

        try {
            await this._browserAgent.freeBrowser(browser);
        } catch (error) {
            logger.warn(`WARNING: can not release browser: ${error}`);
        }
    }
};
