'use strict';
const _ = require('lodash');
const BaseReporter = require('./base');
const helpers = require('./utils/helpers');
const icons = require('./utils/icons');
module.exports = class FlatReporter extends BaseReporter {
    constructor(...args) {
        super(...args);
        this._tests = [];
    }
    _onTestFail(test) {
        super._onTestFail(test);
        this._tests.push(helpers.extendTestInfo(test, { isFailed: true }));
    }
    _onRetry(test) {
        super._onRetry(test);
        this._tests.push(helpers.extendTestInfo(test, { isFailed: false }));
    }
    _onBeforeRunnerEnd(stats) {
        super._onBeforeRunnerEnd(stats);
        const failedTests = helpers.formatFailedTests(this._tests);
        failedTests.forEach((test, index) => {
            this.informer.log(`\n${index + 1}) ${test.fullTitle}`);
            this.informer.log(`   in file ${test.file}\n`);
            _.forEach(test.browsers, (testCase) => {
                const icon = testCase.isFailed ? icons.FAIL : icons.RETRY;
                this.informer.log(`   ${testCase.browserId}`);
                this.informer.log(`     ${icon} ${testCase.error}`);
            });
        });
    }
};
