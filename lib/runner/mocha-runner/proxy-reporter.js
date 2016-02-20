'use strict';

var _ = require('lodash'),
    inherit = require('inherit'),
    mocha = require('mocha'),

    RunnerEvents = require('../../constants/runner-events');

var MochaEvents = {
    SUITE_BEGIN: 'suite',
    SUITE_END: 'suite end',
    TEST_BEGIN: 'test',
    TEST_END: 'test end',
    TEST_PASS: 'pass',
    TEST_PENDING: 'pending',
    FAIL: 'fail'
};

module.exports = inherit(mocha.reporters.Base, {
    __constructor: function(emit, getBrowser, runner) {
        this.__base(runner);
        this._emit = emit;
        this._getBrowser = getBrowser;

        this._listenEvents(runner);
    },

    _listenEvents: function(runner) {
        this._translateEvent(runner, MochaEvents.SUITE_BEGIN, RunnerEvents.SUITE_BEGIN);
        this._translateEvent(runner, MochaEvents.SUITE_END, RunnerEvents.SUITE_END);
        this._translateEvent(runner, MochaEvents.TEST_BEGIN, RunnerEvents.TEST_BEGIN);
        this._translateEvent(runner, MochaEvents.TEST_END, RunnerEvents.TEST_END);
        this._translateEvent(runner, MochaEvents.TEST_PASS, RunnerEvents.TEST_PASS);
        this._translateEvent(runner, MochaEvents.TEST_PENDING, RunnerEvents.TEST_PENDING);

        this._translateFail(runner);
    },

    _translateFail: function(runner) {
        var _this = this;

        runner.on(MochaEvents.FAIL, function(data, err) {
            data = _this._appendSessionInfo(data);

            if (data.type === 'test') {
                if (err && !data.err) {
                    data.err = err;
                }
                _this._emit(RunnerEvents.TEST_FAIL, data);
                return;
            }

            // mocha generates 'test begin' event before `before*` hooks,
            // so if such hook failed - in fact its a test fail
            if (isBeforeHook_(data) && data.ctx && data.ctx.currentTest) {
                data = switchHookAndTest_(data);
                data.err = err;
                _this._emit(RunnerEvents.TEST_FAIL, data);
                return;
            }

            _this._emit(RunnerEvents.ERROR, err, data);
        });

        function isBeforeHook_(data) {
            return data.type === 'hook' && /^.?before/.test(data.originalTitle);
        }

        function switchHookAndTest_(hookData) {
            var testData = hookData.ctx.currentTest;
            hookData.ctx.currentTest = null;
            testData.hook = hookData;
            return testData;
        }
    },

    _translateEvent: function(source, from, to) {
        var _this = this;
        source.on(from, function(data) {
            _this._emit(to, _this._appendSessionInfo(data));
        });
    },

    _appendSessionInfo: function(data) {
        var browser = this._getBrowser();

        return _.extend(data, {
            sessionId: browser.sessionId,
            browserId: browser.id
        });
    }
});
