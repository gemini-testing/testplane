'use strict';

const path = require('path');
const utils = require('q-promise-utils');
const qUtils = require('qemitter/utils');
const QEmitter = require('qemitter');
const _ = require('lodash');
const RunnerEvents = require('../../constants/runner-events');
const MochaAdapter = require('./mocha-adapter');
const RetryMochaRunner = require('./retry-mocha-runner');
const MochaBuilder = require('./mocha-builder');

module.exports = class MochaRunner extends QEmitter {
    static prepare() {
        MochaAdapter.prepare();
    }

    static create(config, browserAgent, testSkipper) {
        return new MochaRunner(config, browserAgent, testSkipper);
    }

    static _validateUniqTitles(mochas) {
        const titles = {};

        mochas.forEach((mocha) => {
            mocha.suite.eachTest((test) => {
                const fullTitle = test.fullTitle();

                if (titles[fullTitle]) {
                    throw new Error(`Cannot use tests with the same title: '${fullTitle}'` +
                        ` in file: '${titles[fullTitle]}'`);
                }

                titles[fullTitle] = path.relative(process.cwd(), test.file);
            });
        });
    }

    constructor(config, browserAgent, testSkipper) {
        super();

        this._config = config.forBrowser(browserAgent.browserId);
        this._mochaBuilder = MochaBuilder.create(config.system, browserAgent, testSkipper);

        qUtils.passthroughEvent(this._mochaBuilder, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);
    }

    buildSuiteTree(suitePaths) {
        return this._mochaBuilder.buildAdapters(suitePaths, Infinity)[0].suite;
    }

    init(suitePaths) {
        this._mochas = this._mochaBuilder.buildAdapters(suitePaths, this._config.testsPerSession);

        MochaRunner._validateUniqTitles(this._mochas);

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
};
