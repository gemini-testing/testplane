'use strict';

const path = require('path');
const utils = require('q-promise-utils');
const qUtils = require('qemitter/utils');
const QEmitter = require('qemitter');
const _ = require('lodash');
const RunnerEvents = require('../../constants/runner-events');
const RetryMochaRunner = require('./retry-mocha-runner');
const MochaBuilder = require('./mocha-builder');

module.exports = class MochaRunner extends QEmitter {
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

        qUtils.passthroughEvent(this._mochaBuilder, this, [
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

            RunnerEvents.HOOK_BEGIN,
            RunnerEvents.HOOK_END,

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
