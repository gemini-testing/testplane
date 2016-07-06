'use strict';

var format = require('util').format,
    inherit = require('inherit'),
    logger = require('../utils').logger,
    RunnerEvents = require('../constants/runner-events'),
    tsm = require('teamcity-service-messages');

module.exports = inherit({
    attachRunner: function(runner) {
        runner.on(RunnerEvents.TEST_BEGIN, (test) => this._onTestBegin(test));
        runner.on(RunnerEvents.TEST_PASS, (test) => this._onTestPass(test));
        runner.on(RunnerEvents.TEST_FAIL, (test) => this._onTestFail(test));
        runner.on(RunnerEvents.SUITE_FAIL, (suite) => this._onSuiteFail(suite));
        runner.on(RunnerEvents.TEST_PENDING, (test) => this._onTestPending(test));

        runner.on(RunnerEvents.WARNING, (info) => this._onWarning(info));
        runner.on(RunnerEvents.ERROR, (err) => this._onError(err));
        runner.on(RunnerEvents.INFO, (info) => this._onInfo(info));
    },

    _onTestBegin: function(test) {
        tsm.testStarted({name: this._getTestName(test), flowId: test.sessionId});
    },

    _onTestPass: function(test) {
        tsm.testFinished({name: this._getTestName(test), flowId: test.sessionId});
    },

    // handling of cases when `before all` hook fails
    _onSuiteFail: function(suite) {
        const name = this._getTestName(suite);

        // when suite fails, 'test begin' events are not generated,
        // so we need to call `testStarted` explicitly
        tsm.testStarted({name, flowId: suite.sessionId});
        this._failAndFinish(name, suite);
    },

    _onTestFail: function(test) {
        this._failAndFinish(this._getTestName(test), test);
    },

    _failAndFinish: function(testName, data) {
        tsm.testFailed({
            name: testName,
            flowId: data.sessionId,
            message: data.err,
            details: data.err && data.err.stack || data.err
        });
        tsm.testFinished({name: testName, flowId: data.sessionId});
    },

    _onTestPending: function(test) {
        tsm.testIgnored({name: this._getTestName(test), flowId: test.sessionId});
    },

    _onWarning: function(info) {
        logger.warn(info);
    },

    _onError: function(error) {
        logger.error(error);
    },

    _onInfo: function(info) {
        logger.log(info);
    },

    _getTestName: function(test) {
        return format('%s [%s: %s]',
            test.fullTitle().trim(),
            test.browserId,
            test.sessionId
        );
    }
});
