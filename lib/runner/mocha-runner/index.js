'use strict';

const utils = require('q-promise-utils');
const qUtils = require('qemitter/utils');
const QEmitter = require('qemitter');
const _ = require('lodash');
const RunnerEvents = require('../../constants/runner-events');
const MochaAdapter = require('./mocha-adapter');
const RetryMochaRunner = require('./retry-mocha-runner');

module.exports = class MochaRunner extends QEmitter {
    static prepare() {
        MochaAdapter.prepare();
    }

    static create(config, browserAgent, testSkipper) {
        return new MochaRunner(config, browserAgent, testSkipper);
    }

    constructor(config, browserAgent, testSkipper) {
        super();

        this._config = config.forBrowser(browserAgent.browserId);
        this._sharedMochaOpts = config.system.mochaOpts;
        this._ctx = _.clone(config.system.ctx);
        this._browserAgent = browserAgent;
        this._testSkipper = testSkipper;
    }

    buildSuiteTree(suitePaths) {
        return this._createMocha(suitePaths, {}).suite;
    }

    init(suitePaths) {
        const titles = {};

        this._mochas = suitePaths.map((path) => this._createMocha(path, titles));

        return this;
    }

    run() {
        return _(this._mochas)
            .map((mocha) => this._runMocha(mocha))
            .thru(utils.waitForResults)
            .value();
    }

    _runMocha(mocha) {
        const retryMochaRunner = RetryMochaRunner.create(mocha, this._config);

        qUtils.passthroughEvent(mocha, this, [
            RunnerEvents.SUITE_BEGIN,
            RunnerEvents.SUITE_END,

            RunnerEvents.TEST_BEGIN,
            RunnerEvents.TEST_END,

            RunnerEvents.TEST_PASS,
            RunnerEvents.TEST_PENDING,

            RunnerEvents.INFO,
            RunnerEvents.WARNING
        ]);

        qUtils.passthroughEvent(retryMochaRunner, this, [
            RunnerEvents.TEST_FAIL,
            RunnerEvents.RETRY,
            RunnerEvents.ERROR
        ]);

        return retryMochaRunner.run();
    }

    _createMocha(paths, titles) {
        const mocha = MochaAdapter.create(this._sharedMochaOpts, this._browserAgent, this._ctx);

        qUtils.passthroughEvent(mocha, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        return mocha
            .attachTitleValidator(titles)
            .applySkip(this._testSkipper)
            .loadFiles([].concat(paths));
    }
};
