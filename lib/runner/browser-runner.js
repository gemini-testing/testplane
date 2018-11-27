'use strict';

const _ = require('lodash');

const Runner = require('./runner');
const TestRunner = require('./test-runner');
const Events = require('../constants/runner-events');
const SuiteMonitor = require('./suite-monitor');
const BrowserAgent = require('./browser-agent');

module.exports = class BrowserRunner extends Runner {
    constructor(browserId, config, browserPool) {
        super();

        this._browserId = browserId;
        this._config = config;
        this._browserPool = browserPool;

        this._suiteMonitor = SuiteMonitor.create();
        this._passthroughEvents(this._suiteMonitor, [
            Events.SUITE_BEGIN,
            Events.SUITE_END
        ]);

        this._activeTestRunners = new Set();
        this._workers = null;
        this._tests = [];
    }

    async run(testCollection, workers) {
        this._tests = testCollection.mapTests(this._browserId, (test) => this._runTest(test, workers));
        this._workers = workers;

        await (async function waitAll(tests) {
            const originalLength = tests.length;
            await Promise.all(tests);

            if (tests.length > originalLength) {
                await waitAll(tests.slice(originalLength));
            }
        })(this._tests);
    }

    addTestToRun(test) {
        if (this._workers === null) {
            return false;
        }

        this._tests.push(this._runTest(test, this._workers));

        return true;
    }

    async _runTest(test, workers) {
        const browserAgent = BrowserAgent.create(this._browserId, this._browserPool);
        const runner = TestRunner.create(test, this._config, browserAgent);

        runner.on(Events.TEST_BEGIN, (test) => this._suiteMonitor.testBegin(test));

        this._passthroughEvents(runner, [
            Events.TEST_BEGIN,
            Events.TEST_END,
            Events.TEST_PASS,
            Events.TEST_FAIL,
            Events.TEST_PENDING,
            Events.RETRY
        ]);

        runner.on(Events.TEST_END, (test) => this._suiteMonitor.testEnd(test));
        runner.on(Events.RETRY, (test) => this._suiteMonitor.testRetry(test));

        this._activeTestRunners.add(runner);

        await runner.run(workers);

        this._activeTestRunners.delete(runner);
    }

    cancel() {
        this._activeTestRunners.forEach((runner) => runner.cancel());
    }

    _passthroughEvents(runner, events) {
        events.forEach((event) => {
            runner.on(event, (data) => this.emit(event, _.extend(data, {browserId: this._browserId})));
        });
    }
};
