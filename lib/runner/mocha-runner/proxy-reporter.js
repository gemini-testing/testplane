'use strict';

const _ = require('lodash');
const mocha = require('mocha');

const AssertViewError = require('../../browser/commands/assert-view/errors/assert-view-error');
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

module.exports = class ProxyReporter extends mocha.reporters.Base {
    constructor(emit, getBrowser, runner) {
        super(runner);

        this._getBrowser = getBrowser;
        this._emitFn = emit;

        this._listenEvents(runner);
    }

    _listenEvents(runner) {
        this._translateEvent(runner, MochaEvents.TEST_BEGIN, RunnerEvents.TEST_BEGIN);
        this._translateEvent(runner, MochaEvents.TEST_END, RunnerEvents.TEST_END);

        this._translateSuiteEvent(runner, MochaEvents.SUITE_BEGIN, RunnerEvents.SUITE_BEGIN);
        this._translateSuiteEvent(runner, MochaEvents.SUITE_END, RunnerEvents.SUITE_END);

        this._translateTestPass(runner);
        this._translatePending(runner);
        this._translateFail(runner);
    }

    _translateSuiteEvent(runner, from, to) {
        runner.on(from, (suite) => {
            if (!suite.root) {
                this._emit(to, suite);
            }
        });
    }

    _translateTestPass(runner) {
        runner.on(MochaEvents.TEST_PASS, (test) => {
            replaceDuration(test);

            if (test.hermioneCtx.assertViewResults && test.hermioneCtx.assertViewResults.hasFails()) {
                test.err = new AssertViewError();
                this._emit(RunnerEvents.TEST_FAIL, test);
            } else {
                this._emit(RunnerEvents.TEST_PASS, test);
            }
        });
    }

    _translatePending(runner) {
        const isSilentSkip = (runnable) => runnable && (runnable.silentSkip || isSilentSkip(runnable.parent));

        runner.on(MochaEvents.TEST_PENDING, (test) => {
            if (!isSilentSkip(test)) {
                this._emit(RunnerEvents.TEST_PENDING, test);
            }
        });
    }

    _translateFail(runner) {
        runner.on(MochaEvents.FAIL, (data, err) => {
            if (data.type !== 'test') {
                this._emit(RunnerEvents.ERROR, err, data);
                return;
            }

            replaceDuration(data);

            if (err && !data.err) {
                data.err = err;
            }

            this._emit(RunnerEvents.TEST_FAIL, data);
        });
    }

    _translateEvent(source, from, to) {
        source.on(from, (data) => this._emit(to, data));
    }

    _emit() {
        const browser = this._getBrowser();
        const data = _.last(arguments);

        _.defaults(data, {
            sessionId: browser.sessionId,
            browserId: browser.id,
            meta: _.clone(browser.meta)
        });

        this._emitFn.apply(null, arguments);
    }
};

function replaceDuration(test) {
    test.duration = test.time || test.duration;

    delete test.time;
}
