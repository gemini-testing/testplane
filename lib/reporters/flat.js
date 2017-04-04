'use strict';

const BaseReporter = require('./base');
const helpers = require('./utils/helpers');

module.exports = class FlatReporter extends BaseReporter {
    constructor() {
        super();

        this._tests = [];
    }

    _onTestFail(test) {
        super._onTestFail(test);

        this._tests.push(helpers.extendTestInfo(test, {isFailed: true}));
    }

    _onRetry(test) {
        super._onRetry(test);

        this._tests.push(helpers.extendTestInfo(test, {isFailed: false}));
    }

    _onRunnerEnd() {
        super._onRunnerEnd();

        helpers.logFailedTestsInfo(this._tests);
    }
};
