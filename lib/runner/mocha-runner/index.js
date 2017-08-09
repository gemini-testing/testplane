'use strict';

const _ = require('lodash');
const utils = require('q-promise-utils');
const qUtils = require('qemitter/utils');
const RunnerEvents = require('../../constants/runner-events');
const BaseMochaRunner = require('./base-mocha-runner');
const RetryMochaRunner = require('./retry-mocha-runner');

module.exports = class MochaRunner extends BaseMochaRunner {
    constructor(browserId, config, browserPool, testSkipper) {
        super(browserId, config, browserPool, testSkipper, {
            MochaBuilder: require('./mocha-builder')
        });
    }

    buildSuiteTree(suitePaths) {
        const mocha = this._mochaBuilder.buildSingleAdapter(suitePaths);

        MochaRunner._validateUniqTitles(mocha);

        return mocha.suite;
    }

    run(workers) {
        return _(this._mochas)
            .map((mocha) => this._runMocha(mocha, workers))
            .thru(utils.waitForResults)
            .value();
    }

    _runMocha(mocha, workers) {
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

        return retryMochaRunner.run(workers);
    }
};
