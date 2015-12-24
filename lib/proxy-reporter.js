'use strict';

var _ = require('lodash'),
    inherit = require('inherit'),
    mocha = require('mocha'),

    RunnerEvents = require('./constants/runner-events');

var MochaEvents = {
    SUITE_BEGIN: 'suite',
    SUITE_END: 'suite end',
    TEST_BEGIN: 'test',
    TEST_END: 'test end',
    TEST_PASS: 'pass',
    TEST_FAIL: 'fail',
    TEST_PENDING: 'pending'
};

module.exports = inherit(mocha.reporters.Base, {
    __constructor: function(runner, options) {
        this.__base(runner);
        this._emit = options.reporterOptions.emit;
        this._getBrowser = options.reporterOptions.getBrowser;
        this._browserId = options.reporterOptions.browserId;

        this._listenEvents(runner);
    },

    _listenEvents: function(runner) {
        this._translateEvent(runner, MochaEvents.SUITE_BEGIN, RunnerEvents.SUITE_BEGIN);
        this._translateEvent(runner, MochaEvents.SUITE_END, RunnerEvents.SUITE_END);
        this._translateEvent(runner, MochaEvents.TEST_BEGIN, RunnerEvents.TEST_BEGIN);
        this._translateEvent(runner, MochaEvents.TEST_END, RunnerEvents.TEST_END);
        this._translateEvent(runner, MochaEvents.TEST_PASS, RunnerEvents.TEST_PASS);
        this._translateEvent(runner, MochaEvents.TEST_FAIL, RunnerEvents.TEST_FAIL);
        this._translateEvent(runner, MochaEvents.TEST_PENDING, RunnerEvents.TEST_PENDING);
    },

    _translateEvent: function(source, from, to) {
        var _this = this;

        source.on(from, function(data, error) {
            var extended = _this._appendSessionInfo(data);

            _this._emit(
                to,
                error ? _.extend(extended, {error: error}) : extended
            );
        });
    },

    _appendSessionInfo: function(data) {
        var browser = this._getBrowser();

        return _.extend(data, {
            sessionId: browser && browser.sessionId,
            browserId: this._browserId
        });
    }
});
