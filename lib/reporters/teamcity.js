'use strict';

var format = require('util').format,
    inherit = require('inherit'),
    logger = require('../utils').logger,
    RunnerEvents = require('../constants/runner-events'),
    tsm = require('teamcity-service-messages');

module.exports = inherit({
    attachRunner: function(runner) {
        runner.on(RunnerEvents.TEST_BEGIN, this._onTestBegin.bind(this));
        runner.on(RunnerEvents.TEST_PASS, this._onTestPass.bind(this));
        runner.on(RunnerEvents.TEST_FAIL, this._onTestFail.bind(this));
        runner.on(RunnerEvents.TEST_PENDING, this._onTestPending.bind(this));

        runner.on(RunnerEvents.WARNING, this._onWarning.bind(this));
        runner.on(RunnerEvents.ERROR, this._onError.bind(this));
        runner.on(RunnerEvents.INFO, this._onInfo.bind(this));
    },

    _onTestBegin: function(test) {
        tsm.testStarted({name: this._getTestName(test), flowId: test.sessionId});
    },

    _onTestPass: function(test) {
        tsm.testFinished({name: this._getTestName(test), flowId: test.sessionId});
    },

    _onTestFail: function(test) {
        var testName = this._getTestName(test);

        tsm.testFailed({
            name: testName,
            flowId: test.sessionId,
            message: test.err,
            details: test.err && test.err.stack || test.err
        });
        tsm.testFinished({name: testName, flowId: test.sessionId});
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
