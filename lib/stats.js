'use strict';

const {BaseStats} = require('gemini-core');
const RunnerEvents = require('./constants/runner-events');

const statNames = {
    TOTAL: 'total',
    PASSED: 'passed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
    RETRIES: 'retries'
};

module.exports = class Stats extends BaseStats {
    constructor() {
        super(statNames);
    }

    attachRunner(runner) {
        runner
            .on(RunnerEvents.TEST_PASS, (test) => this.addPassed(test))
            .on(RunnerEvents.TEST_FAIL, (test) => this.addFailed(test))
            .on(RunnerEvents.RETRY, () => this.addRetries())
            .on(RunnerEvents.TEST_PENDING, (test) => this.addSkipped(test));
    }

    _buildStateKey(test) {
        return test.title;
    }

    _buildSuiteKey(test) {
        return `${test.parent.fullTitle()} ${test.browserId}`;
    }
};
