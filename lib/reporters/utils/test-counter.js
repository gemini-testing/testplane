'use strict';

const _ = require('lodash');

const STATS = {
    total: 'total',
    passed: 'passed',
    failed: 'failed',
    pending: 'pending'
};

module.exports = class TestCounter {
    constructor() {
        this._tests = {};

        this._retries = 0;
    }

    onTestPass(passed) {
        this._addStat(STATS.passed, passed);
    }

    onTestFail(failed) {
        this._addStat(STATS.failed, failed);
    }

    onTestPending(pending) {
        this._addStat(STATS.pending, pending);
    }

    onTestRetry() {
        this._retries++;
    }

    _addStat(type, test) {
        this._tests[test.fullTitle() + ' ' + test.browserId] = type;
    }

    getResult() {
        return _(STATS)
            .mapValues(() => 0)
            .thru((result) => {
                return _.reduce(this._tests, (res, stat) => {
                    res.total++;
                    res[stat]++;

                    return res;
                }, result);
            })
            .extend({retries: this._retries})
            .value();
    }
};
