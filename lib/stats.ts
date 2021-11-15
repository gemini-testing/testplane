import _ from 'lodash';
import { BaseStats } from 'gemini-core';

import RunnerEvents from './constants/runner-events';

import type Hermione from './hermione';
import type { Test } from './types/mocha';

const statNames = {
    TOTAL: 'total',
    PASSED: 'passed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
    RETRIES: 'retries'
} as const;

export default class Stats extends BaseStats {
    private _statsByBrowsers: {[browserId: string]: };
    private _testsByBrowsers;

    constructor(runner: Hermione) {
        super(statNames);

        this._statsByBrowsers = {};
        this._testsByBrowsers = {};

        runner && runner
            .on(RunnerEvents.TEST_PASS, (test) => this.addPassed(test))
            .on(RunnerEvents.TEST_FAIL, (test) => this.addFailed(test))
            .on(RunnerEvents.RETRY, (test) => this.addRetries(test))
            .on(RunnerEvents.TEST_PENDING, (test) => this.addSkipped(test));
    }

    public override addRetries(test: Test): void {
        super.addRetries();

        const bro = this._getBrowser(test.browserId);

        bro.retries++;
    }

    public getResult() {
        const data = super.getResult();

        Object.keys(this._statsByBrowsers).forEach((broName) => {
            this._statsByBrowsers[broName].total = this._testsByBrowsers[broName].size;
        });

        return _.extend(data, {perBrowser: this._statsByBrowsers});
    }

    private _addStat(stat, test: Test) {
        super._addStat(stat, test);

        this._addBrowserStat(stat, test);
    }

    private _addBrowserStat(stat, test: Test) {
        const browserId = test.browserId;

        super._addStat(stat, test, this._getBrowser(browserId), this._testsByBrowsers[browserId]);
    }

    private _getBrowser(browserId: string) {
        return this._statsByBrowsers[browserId] || this._fillEmptyBrowser(browserId);
    }

    private _fillEmptyBrowser(browserId: string) {
        this._statsByBrowsers[browserId] = this._fillEmptyStats();
        this._testsByBrowsers[browserId] = new Set();

        return this._statsByBrowsers[browserId];
    }

    private _buildStateKey(test: Test): string {
        return test.title;
    }

    private _buildSuiteKey(test: Test): string {
        return `${test.parent?.fullTitle()} ${test.browserId}`;
    }
};
