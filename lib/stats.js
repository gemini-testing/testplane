'use strict';

const _ = require('lodash');
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
    constructor(runner) {
        super(statNames);

        this._browsers = {};
        this._testsByBrowsers = {};

        runner && runner
            .on(RunnerEvents.TEST_PASS, (test) => this.addPassed(test))
            .on(RunnerEvents.TEST_FAIL, (test) => this.addFailed(test))
            .on(RunnerEvents.RETRY, (test) => this.addRetries(test))
            .on(RunnerEvents.TEST_PENDING, (test) => this.addSkipped(test));
    }

    addRetries(test) {
        super.addRetries();

        const bro = this._getBrowser(test.browserId);

        bro.retries++;
    }

    getResult() {
        const data = super.getResult();

        _.values(this._browsers).forEach((bro) => {
            bro.total = bro.passed + bro.failed + bro.skipped;
        });

        return _.extend(data, {perBrowser: this._browsers});
    }

    _addStat(stat, test) {
        super._addStat(stat, test);

        this._addBrowserStat(stat, test);
    }

    _addBrowserStat(stat, test) {
        const browserId = test.browserId;

        this._addStatOnce(stat, test, this._getBrowser(browserId), this._testsByBrowsers[browserId]);
    }

    _getBrowser(browserId) {
        return this._browsers[browserId] || this._fillEmptyBrowser(browserId);
    }

    _fillEmptyBrowser(browserId) {
        this._browsers[browserId] = this._fillEmptyStats();
        this._testsByBrowsers[browserId] = {};

        return this._browsers[browserId];
    }

    _buildStateKey(test) {
        return test.title;
    }

    _buildSuiteKey(test) {
        return `${test.parent.fullTitle()} ${test.browserId}`;
    }
};
