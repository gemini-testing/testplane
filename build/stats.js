'use strict';
const _ = require('lodash');
const BaseStats = require('./core/base-stats').default;
const RunnerEvents = require('./constants/runner-events');
const statNames = {
    TOTAL: 'total',
    PASSED: 'passed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
    RETRIES: 'retries'
};
module.exports = class Stats extends BaseStats {
    static create(runner) {
        return new Stats(runner);
    }
    constructor(runner) {
        super(statNames);
        this._statsByBrowsers = {};
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
        Object.keys(this._statsByBrowsers).forEach((broName) => {
            this._statsByBrowsers[broName].total = this._testsByBrowsers[broName].size;
        });
        return _.extend(data, { perBrowser: this._statsByBrowsers });
    }
    _addStat(stat, test) {
        super._addStat(stat, test);
        this._addBrowserStat(stat, test);
    }
    _addBrowserStat(stat, test) {
        const browserId = test.browserId;
        super._addStat(stat, test, this._getBrowser(browserId), this._testsByBrowsers[browserId]);
    }
    _getBrowser(browserId) {
        return this._statsByBrowsers[browserId] || this._fillEmptyBrowser(browserId);
    }
    _fillEmptyBrowser(browserId) {
        this._statsByBrowsers[browserId] = this._fillEmptyStats();
        this._testsByBrowsers[browserId] = new Set();
        return this._statsByBrowsers[browserId];
    }
    _buildStateKey(test) {
        return test.title;
    }
    _buildSuiteKey(test) {
        return `${test.parent.fullTitle()} ${test.browserId}`;
    }
};
