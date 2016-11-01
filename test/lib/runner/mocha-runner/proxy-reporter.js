'use strict';

var _ = require('lodash'),
    EventEmitter = require('events').EventEmitter,
    ProxyReporter = require('../../../../lib/runner/mocha-runner/proxy-reporter');

describe('mocha-runner/proxy-reporter', function() {
    var sandbox = sinon.sandbox.create(),
        runner,
        emit;

    function createReporter_(browserProps) {
        browserProps = _.defaults(browserProps || {}, {
            sessionId: 'default-session-id',
            id: 'default-browser'
        });

        var getBrowser = sinon.stub().returns(browserProps);
        return new ProxyReporter(emit, getBrowser, runner);
    }

    function testTranslateEvent_(from, to) {
        it('should translate event `' + from + '` to event `' + to + '`', function() {
            createReporter_();

            runner.emit(from, {slow: sinon.stub()}); // slow will be called by Mocha.BaseReporter inside

            assert.calledWith(emit, to);
        });
    }

    beforeEach(function() {
        runner = new EventEmitter();
        emit = sandbox.stub().named('emit');
    });

    afterEach(function() {
        sandbox.restore();
    });

    testTranslateEvent_('suite', 'beginSuite');
    testTranslateEvent_('suite end', 'endSuite');
    testTranslateEvent_('test', 'beginTest');
    testTranslateEvent_('test end', 'endTest');
    testTranslateEvent_('pass', 'passTest');
    testTranslateEvent_('pending', 'pendingTest');

    it('should translate `fail` event from test to `failTest`', function() {
        createReporter_();

        runner.emit('fail', {type: 'test'}, {message: 'foo'});

        assert.calledWithMatch(emit, 'failTest', {
            err: {message: 'foo'}
        });
    });

    it('should translate `fail` event from `before each` hook to `failTest`', function() {
        createReporter_();

        var hook = {
            type: 'hook',
            title: '"before each" hook for "some test"',
            ctx: {
                currentTest: {
                    title: 'some test'
                }
            }
        };

        runner.emit('fail', hook, {message: 'foo'});

        assert.calledWithMatch(emit, 'failTest', {
            title: 'some test',
            err: {message: 'foo'},
            hook: hook
        });
    });

    it('should translate `fail` event from `before all` hook to `failSuite`', () => {
        createReporter_();

        const hook = {
            type: 'hook',
            title: '"before all" hook',
            parent: {
                tests: [{title: 'some test'}]
            },
            err: {message: 'foo'}
        };

        runner.emit('fail', hook);

        assert.calledWith(emit, 'failSuite', hook);
    });

    it('should translate `fail` event from after* hook to `err`', function() {
        createReporter_();

        var hook = {
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

    it('should translate `fail` event from hook without currentTest to `err`', function() {
        createReporter_();

        var hook = {
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

    it('should translate `fail` event from other source to `err`', function() {
        createReporter_();

        runner.emit('fail', {title: 'some-title'}, {message: 'foo'});

        assert.calledWithMatch(emit, 'err',
            {message: 'foo'},
            {title: 'some-title'}
        );
    });

    it('should translate test data from mocha', function() {
        createReporter_();

        runner.emit('suite', {foo: 'bar'});

        assert.calledWithMatch(emit, 'beginSuite', {
            foo: 'bar'
        });
    });

    it('should add `browserId` and `sessionId` ', function() {
        createReporter_({id: 'browserId', sessionId: 'mySessionId'});

        runner.emit('suite', {foo: 'bar'});

        assert.calledWithMatch(emit, 'beginSuite', {
            browserId: 'browserId',
            sessionId: 'mySessionId'
        });
    });

    it('should add meta info copy', function() {
        const meta = {url: '/some/url'};
        createReporter_({meta});

        runner.emit('pass', {slow: sinon.stub()});

        assert.calledWithMatch(emit, 'passTest', {meta});
        assert.notStrictEqual(emit.firstCall.args[1].meta, meta);
    });
});
