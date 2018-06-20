'use strict';

const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
const ProxyReporter = require('lib/worker/runner/proxy-reporter');

describe('mocha-runner/proxy-reporter', () => {
    const sandbox = sinon.sandbox.create();

    let runner;
    let emit;

    const createReporter_ = (browserProps) => {
        browserProps = _.defaults(browserProps || {}, {
            sessionId: 'default-session-id',
            id: 'default-browser'
        });

        const getBrowser = sinon.stub().returns(browserProps);
        return new ProxyReporter(emit, getBrowser, runner);
    };

    const testTranslateEvent_ = (from, to) => {
        it(`should translate event "${from}" to event "${to}"`, () => {
            createReporter_();

            runner.emit(from, {});

            assert.calledWith(emit, to);
        });
    };

     // slow will be called by Mocha.BaseReporter inside
    const stubTest = (opts) => _.extend({}, opts, {type: 'test', slow: sinon.stub(), hermioneCtx: {}});

    beforeEach(() => {
        runner = new EventEmitter();
        emit = sandbox.stub().named('emit');
    });

    afterEach(() => sandbox.restore());

    testTranslateEvent_('suite', 'beginSuite');
    testTranslateEvent_('suite end', 'endSuite');
    testTranslateEvent_('test', 'beginTest');
    testTranslateEvent_('test end', 'endTest');
    testTranslateEvent_('pending', 'pendingTest');

    [
        {mochaEvent: 'suite', runnerEvent: 'beginSuite'},
        {mochaEvent: 'suite end', runnerEvent: 'endSuite'}
    ].forEach((e) => {
        describe(`"${e.mochaEvent}" event`, () => {
            beforeEach(() => createReporter_());

            it(`should translate event ${e.mochaEvent} to event ${e.runnerEvent}`, () => {
                const suite = {root: false};

                runner.emit(e.mochaEvent, suite);

                assert.calledWith(emit, e.runnerEvent);
            });

            it(`should not translate event ${e.mochaEvent} to event ${e.runnerEvent} for root suite`, () => {
                const suite = {root: true};

                runner.emit(e.mochaEvent, suite);

                assert.notCalled(emit);
            });
        });
    });

    describe('"pass" event', () => {
        beforeEach(() => createReporter_());

        it('should translate event "pass" to event "passTest"', () => {
            const test = stubTest({duration: 100500, time: 500100});
            runner.emit('pass', test);

            assert.calledWithMatch(emit, 'passTest', {duration: 500100});
            assert.notProperty(test, 'time');
        });

        it('should translate event "pass" to event "failTest" in case of assert view errors', () => {
            const test = stubTest();
            test.hermioneCtx.assertViewResults = {
                hasFails: sandbox.stub().returns(true)
            };

            runner.emit('pass', test);

            assert.calledOnceWith(emit, 'failTest', test);
        });
    });

    describe('"pending" event', () => {
        beforeEach(() => createReporter_());

        it('should not translate "pending" event if an entity was skipped silently', () => {
            runner.emit('pending', {silentSkip: true});

            assert.notCalled(emit);
        });

        it('should not translate "pending" event if a parent of an entity was skipped silently', () => {
            runner.emit('pending', {parent: {parent: {silentSkip: true}}});

            assert.notCalled(emit);
        });

        it('should translate "pending" event if an entity was not skipped silently', () => {
            runner.emit('pending', {foo: 'bar'});

            assert.calledWithMatch(emit, 'pending', {foo: 'bar'});
        });
    });

    describe('"fail" event', () => {
        beforeEach(() => createReporter_());

        it('should translate `fail` event from test to `failTest`', () => {
            const test = stubTest({duration: 100500, time: 500100});

            runner.emit('fail', test, {message: 'foo'});

            assert.calledWithMatch(emit, 'failTest', {
                duration: 500100,
                err: {message: 'foo'}
            });
            assert.notProperty(test, 'time');
        });

        it('should translate `fail` event from after* hook to `err`', () => {
            const hook = {
                type: 'hook',
                title: '"after each" hook for "some test"',
                originalTitle: '"after each" hook',
                ctx: {
                    currentTest: {
                        title: 'some test'
                    }
                }
            };

            runner.emit('fail', hook, {message: 'foo'});

            assert.calledWithMatch(emit, 'err',
                {message: 'foo'},
                hook
            );
        });

        it('should translate `fail` event from hook without currentTest to `err`', () => {
            const hook = {
                type: 'hook',
                title: '"before All" hook',
                ctx: {}
            };

            runner.emit('fail', hook, {message: 'foo'});

            assert.calledWithMatch(emit, 'err',
                {message: 'foo'},
                hook
            );
        });

        it('should translate `fail` event from other source to `err`', () => {
            runner.emit('fail', {title: 'some-title'}, {message: 'foo'});

            assert.calledWithMatch(emit, 'err',
                {message: 'foo'},
                {title: 'some-title'}
            );
        });
    });

    it('should translate test data from mocha', () => {
        createReporter_();

        runner.emit('suite', {foo: 'bar'});

        assert.calledWithMatch(emit, 'beginSuite', {
            foo: 'bar'
        });
    });

    it('should add `browserId` and `sessionId`', () => {
        createReporter_({id: 'browserId', sessionId: 'mySessionId'});

        runner.emit('suite', {foo: 'bar'});

        assert.calledWithMatch(emit, 'beginSuite', {
            browserId: 'browserId',
            sessionId: 'mySessionId'
        });
    });

    it('should add meta info copy', () => {
        const meta = {url: '/some/url'};
        createReporter_({meta});

        runner.emit('pass', stubTest());

        assert.calledWithMatch(emit, 'passTest', {meta});
        assert.notStrictEqual(emit.firstCall.args[1].meta, meta);
    });
});
