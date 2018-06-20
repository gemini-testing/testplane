'use strict';

const EventEmitter = require('events').EventEmitter;
const utils = require('q-promise-utils');
const _ = require('lodash');
const Events = require('../../constants/runner-events');
const BrowserAgent = require('gemini-core').BrowserAgent;
const TestRunner = require('../test-runner');
const MochaBuilder = require('./mocha-builder');
const SuiteMonitor = require('../../suite-monitor');

module.exports = class MochaRunner extends EventEmitter {
    static prepare() {
        MochaBuilder.prepare();
    }

    static create(...args) {
        return new MochaRunner(...args);
    }

    constructor(browserId, config, browserPool, testSkipper) {
        super();

        this._config = config;
        this._suiteMonitor = SuiteMonitor.create();
        this._mochaBuilder = MochaBuilder.create(browserId, config.system, testSkipper);

        this._browserId = browserId;
        this._browserPool = browserPool;

        this._passthroughEvents(this._mochaBuilder, [
            Events.BEFORE_FILE_READ,
            Events.AFTER_FILE_READ
        ]);

        this._passthroughEvents(this._suiteMonitor, [
            Events.SUITE_BEGIN,
            Events.SUITE_END
        ]);
    }

    init(filepaths) {
        this._mocha = this._mochaBuilder.buildSingleAdapter(filepaths);

        return this;
    }

    buildSuiteTree(filepaths) {
        this.init(filepaths);
        return this._mocha.suite;
    }

    async run(workers) {
        const tests = await this._mocha.parse();

        return _(tests)
            .map((test) => this._runTest(test, workers))
            .thru(utils.waitForResults)
            .value();
    }

    _runTest(test, workers) {
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

        runner.on(Events.RETRY, (test) => this._suiteMonitor.testRetry(test));
        runner.on(Events.TEST_END, (test) => this._suiteMonitor.testEnd(test));

        return runner.run(workers);
    }

    _passthroughEvents(runner, events) {
        events.forEach((event) => {
            runner.on(event, (data) => this.emit(event, _.extend(data, {browserId: this._browserId})));
        });
    }
};
