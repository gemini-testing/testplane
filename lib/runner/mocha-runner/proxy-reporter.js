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
        runner.on(MochaEvents.FAIL, (data, err) => {
            data = this._appendSessionInfo(data);

            if (data.type === 'test') {
                if (err && !data.err) {
                    data.err = err;
                }
                this._emit(RunnerEvents.TEST_FAIL, data);
                return;
            }

            // mocha generates 'test begin' event before `before each` hooks,
            // so if such hook failed, in fact, it's a test fail
            if (isBeforeEachHook(data) && data.ctx && data.ctx.currentTest) {
                data = switchHookAndTest_(data);
                data.err = err;
                this._emit(RunnerEvents.TEST_FAIL, data);
                return;
            }

            // mocha generates 'test begin' events after `before all` hooks,
            // so if such hook failed, in fact, it's a suite fail
            if (isBeforeAllHook(data)) {
                this._emit(RunnerEvents.SUITE_FAIL, data);
                return;
            }

            this._emit(RunnerEvents.ERROR, err, data);
        });

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

function isHook(data) {
    return data.type === 'hook';
}

function testHook(type, data) {
    return new RegExp(`^.?${type}`).test(data.title);
}

function isBeforeEachHook(data) {
    return isHook(data) && testHook('before each', data);
}

function isBeforeAllHook(data) {
    return isHook(data) && testHook('before all', data);
}
