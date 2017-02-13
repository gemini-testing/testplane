'use strict';

const _ = require('lodash');
const utils = require('q-promise-utils');
const QEmitter = require('qemitter');
const qUtils = require('qemitter/utils');

const BrowserAgent = require('../browser-agent');
const BrowserPool = require('../browser-pool');
const RunnerEvents = require('../constants/runner-events');
const MochaRunner = require('./mocha-runner');
const RetryManager = require('../retry-manager');
const TestSkipper = require('./test-skipper');
const logger = require('../utils').logger;

module.exports = class MainRunner extends QEmitter {
    static create(config) {
        return new MainRunner(config);
    }

    constructor(config) {
        super();

        this._config = config;

        this._testSkipper = TestSkipper.create(this._config);

        this._retryMgr = new RetryManager(this._config);
        qUtils.passthroughEvent(this._retryMgr, this, [
            RunnerEvents.TEST_FAIL,
            RunnerEvents.SUITE_FAIL,
            RunnerEvents.ERROR,
            RunnerEvents.RETRY
        ]);

        this._pool = new BrowserPool(this._config);

        MochaRunner.init();
    }

    run(tests) {
        return this.emitAndWait(RunnerEvents.RUNNER_START, this)
            .then(() => this._runTestSession(tests))
            .fin(() => {
                return this.emitAndWait(RunnerEvents.RUNNER_END)
                    .catch(logger.warn);
            });
    }

    buildSuiteTree(tests) {
        return _.mapValues(tests, (files, browserId) => {
            const browserAgent = BrowserAgent.create(browserId, this._pool);
            const mochaRunner = MochaRunner.create(this._config, browserAgent, this._testSkipper);

            return mochaRunner.buildSuiteTree(files);
        });
    }

    _runTestSession(tests, filterFn) {
        const _this = this;

        return _(tests)
            .map((files, browserId) => _this._runInBrowser(browserId, files, filterFn))
            .thru(utils.waitForResults)
            .value()
            .then(function() {
                return _this._retryMgr.retry(_this._runTestSession.bind(_this));
            });
    }

    _runInBrowser(browserId, files, filterFn) {
        const browserAgent = BrowserAgent.create(browserId, this._pool);
        const mochaRunner = MochaRunner.create(this._config, browserAgent, this._testSkipper);

        qUtils.passthroughEvent(mochaRunner, this, [
            RunnerEvents.SUITE_BEGIN,
            RunnerEvents.SUITE_END,

            RunnerEvents.TEST_BEGIN,
            RunnerEvents.TEST_END,

            RunnerEvents.TEST_PASS,
            RunnerEvents.TEST_PENDING,

            RunnerEvents.INFO,
            RunnerEvents.WARNING
        ]);

        qUtils.passthroughEventAsync(browserAgent, this, [
            RunnerEvents.SESSION_START,
            RunnerEvents.SESSION_END
        ]);

        mochaRunner.on(RunnerEvents.TEST_FAIL, (data) => this._retryMgr.handleTestFail(data));
        mochaRunner.on(RunnerEvents.SUITE_FAIL, (data) => this._retryMgr.handleSuiteFail(data));
        mochaRunner.on(RunnerEvents.ERROR, (err, data) => this._retryMgr.handleError(err, data));

        return mochaRunner.run(files, filterFn);
    }
};
