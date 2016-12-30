'use strict';

const _ = require('lodash');
const inherit = require('inherit');
const mocha = require('mocha');

const RunnerEvents = require('../../constants/runner-events');

const MochaEvents = {
    SUITE_BEGIN: 'suite',
    SUITE_END: 'suite end',
    TEST_BEGIN: 'test',
    TEST_END: 'test end',
    TEST_PASS: 'pass',
    TEST_PENDING: 'pending',
    FAIL: 'fail'
};

const isHook = (data) => data.type === 'hook';
const testHook = (type, data) => new RegExp(`^.?${type}`).test(data.title);

const isBeforeEachHook = (data) => isHook(data) && testHook('before each', data);
const isBeforeAllHook = (data) => isHook(data) && testHook('before all', data);

module.exports = inherit(mocha.reporters.Base, {
    __constructor: function(emit, getBrowser, runner) {
        this.__base(runner);
        this._getBrowser = getBrowser;
        this._emitFn = emit;

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
            const testData = hookData.ctx.currentTest;
            hookData.ctx.currentTest = null;
            testData.hook = hookData;
            return testData;
        }
    },

    _translateEvent: function(source, from, to) {
        source.on(from, (data) => this._emit(to, data));
    },

    _emit: function() {
        const browser = this._getBrowser();
        const data = _.last(arguments);

        _.extend(data, {
            sessionId: browser.sessionId,
            browserId: browser.id,
            meta: _.clone(browser.meta)
        });

        this._emitFn.apply(null, arguments);
    }
});
