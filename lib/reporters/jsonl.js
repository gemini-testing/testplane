'use strict';

const BaseReporter = require('./base');
const {extendTestInfo} = require('./utils/helpers');
const {SUCCESS, FAIL, RETRY, SKIPPED} = require('../constants/test-statuses');

module.exports = class JsonlReporter extends BaseReporter {
    _onTestPass(test) {
        const testInfo = extendTestInfo(test, {status: SUCCESS});
        this.informer.log(testInfo);
    }

    _onTestFail(test) {
        this.informer.log(extendTestInfo(test, {status: FAIL}));
    }

    _onRetry(test) {
        this.informer.log(extendTestInfo(test, {status: RETRY}));
    }

    _onTestPending(test) {
        this.informer.log(extendTestInfo(test, {status: SKIPPED}));
    }

    _onRunnerEnd() {
        this.informer.end();
    }

    _onWarning() {
        // do nothing
    }

    _onError() {
        // do nothing
    }

    _onInfo() {
        // do nothing
    }
};
