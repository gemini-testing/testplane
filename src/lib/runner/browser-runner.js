"use strict";

const _ = require("lodash");

const Runner = require("./runner");
const TestRunner = require("./test-runner");
const Events = require("../constants/runner-events");
const SuiteMonitor = require("./suite-monitor");
const BrowserAgent = require("./browser-agent");
const PromiseGroup = require("./promise-group");

module.exports = class BrowserRunner extends Runner {
    constructor(browserId, config, browserPool, workers) {
        super();

        this._browserId = browserId;
        this._config = config;
        this._browserPool = browserPool;

        this._suiteMonitor = SuiteMonitor.create();
        this._passthroughEvents(this._suiteMonitor, [
            Events.SUITE_BEGIN,
            Events.SUITE_END,
        ]);

        this._activeTestRunners = new Set();
        this._workers = workers;
        this._running = new PromiseGroup();
    }

    get browserId() {
        return this._browserId;
    }

    async run(testCollection) {
        testCollection.eachTestByVersions(this._browserId, (test) => {
            this._running.add(this._runTest(test));
        });

        await this._running.done();
    }

    addTestToRun(test) {
        if (this._running.isFulfilled()) {
            return false;
        }

        this._running.add(this._runTest(test));

        return true;
    }

    async _runTest(test) {
        const browserAgent = BrowserAgent.create(this._browserId, test.browserVersion, this._browserPool);
        const runner = TestRunner.create(test, this._config, browserAgent);

        runner.on(Events.TEST_BEGIN, (test) => this._suiteMonitor.testBegin(test));

        this._passthroughEvents(runner, [
            Events.TEST_BEGIN,
            Events.TEST_END,
            Events.TEST_PASS,
            Events.TEST_FAIL,
            Events.TEST_PENDING,
            Events.RETRY,
        ]);

        runner.on(Events.TEST_END, (test) => this._suiteMonitor.testEnd(test));
        runner.on(Events.RETRY, (test) => this._suiteMonitor.testRetry(test));

        this._activeTestRunners.add(runner);

        await runner.run(this._workers);

        this._activeTestRunners.delete(runner);
    }

    cancel() {
        this._activeTestRunners.forEach((runner) => runner.cancel());
    }

    _passthroughEvents(runner, events) {
        events.forEach((event) => {
            runner.on(event, (data) => this.emit(event, _.extend(data, { browserId: this._browserId })));
        });
    }
};
