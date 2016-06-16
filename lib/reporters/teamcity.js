'use strict';

var format = require('util').format,
    inherit = require('inherit'),
    FlatReporter = require('./flat'),
    tsm = require('teamcity-service-messages');

module.exports = inherit(FlatReporter, {
    _onRunnerEnd: function() {
        this._results.forEach(function(test) {
            var testName = this._getTestName(test);

            if (test.pending) {
                tsm.testIgnored({name: testName, flowId: test.sessionId});
                return;
            }

            tsm.testStarted({name: testName, flowId: test.sessionId});

            if (test.state === 'passed') {
                tsm.testFinished({name: testName, flowId: test.sessionId});
            } else if (test.state === 'failed') {
                tsm.testFailed({
                    name: testName,
                    flowId: test.sessionId,
                    message: test.err,
                    details: test.err && test.err.stack || test.err
                });
            }
        }.bind(this));

        this.__base();
    },

    _getTestName: function(test) {
        return format('%s [%s: %s]',
            test.fullTitle().trim(),
            test.browserId,
            test.sessionId
        );
    }
});
