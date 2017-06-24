'use strict';

const path = require('path');
const _ = require('lodash');
const PassthroughEmitter = require('gemini-core').PassthroughEmitter;
const promiseUtils = require('gemini-core').promiseUtils;
const RunnerEvents = require('../../constants/runner-events');
const RetryMochaRunner = require('./retry-mocha-runner');
const MochaBuilder = require('./mocha-builder');

module.exports = class MochaRunner extends PassthroughEmitter {
    static prepare() {
        MochaBuilder.prepare();
    }

    static create(browserId, config, browserPool, testSkipper) {
        return new MochaRunner(browserId, config, browserPool, testSkipper);
    }

    constructor(browserId, config, browserPool, testSkipper) {
        super();

        this._config = config.forBrowser(browserId);
        this._mochaBuilder = MochaBuilder.create(browserId, config.system, browserPool, testSkipper);

        this.passthroughEvent(this._mochaBuilder, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);
    }

    buildSuiteTree(suitePaths) {
        const mocha = this._mochaBuilder.buildSingleAdapter(suitePaths);

        validateUniqTitles(mocha);

        return mocha.suite;
    }

    init(suitePaths) {
        this._mochas = this._mochaBuilder.buildAdapters(suitePaths);

        validateUniqTitles(this._mochas);
        this._mochas.forEach((mocha) => mocha.disableHooksInSkippedSuites());

        return this;
    }

    run() {
        return _(this._mochas)
            .map((mocha) => this._runMocha(mocha))
            .thru(promiseUtils.waitForResults)
            .value();
    }

    _runMocha(mocha) {
        const retryMochaRunner = RetryMochaRunner.create(mocha, this._config);

        this.passthroughEvent(mocha, [
            RunnerEvents.SUITE_BEGIN,
            RunnerEvents.SUITE_END,

            RunnerEvents.TEST_BEGIN,
            RunnerEvents.TEST_END,

            RunnerEvents.TEST_PASS,
            RunnerEvents.TEST_PENDING,

            RunnerEvents.INFO,
            RunnerEvents.WARNING
        ]);

        this.passthroughEvent(retryMochaRunner, [
            RunnerEvents.TEST_FAIL,
            RunnerEvents.RETRY,
            RunnerEvents.ERROR
        ]);

        return retryMochaRunner.run();
    }
};

function validateUniqTitles(mochas) {
    const titles = {};

    [].concat(mochas).forEach((mocha) => {
        mocha.suite.eachTest((test) => {
            const fullTitle = test.fullTitle();
            const relatePath = path.relative(process.cwd(), test.file);

            if (!titles[fullTitle]) {
                titles[fullTitle] = path.relative(process.cwd(), test.file);
                return;
            }

            if (titles[fullTitle] === relatePath) {
                throw new Error(`Tests with the same title '${fullTitle}'` +
                    ` in file '${titles[fullTitle]}' can't be used`);
            } else {
                throw new Error(`Tests with the same title '${fullTitle}'` +
                    ` in files '${titles[fullTitle]}' and '${relatePath}' can't be used`);
            }
        });
    });
}
