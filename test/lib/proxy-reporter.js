'use strict';

var EventEmitter = require('events').EventEmitter,
    ProxyReporter = require('../../lib/proxy-reporter');

describe('Proxy reporter', function() {
    var sandbox = sinon.sandbox.create(),
        runner,
        emit;

    function createReporter_(browserId, sessionId) {
        return new ProxyReporter(runner, {
            reporterOptions: {
                emit: emit,
                browserId: browserId || 'default-browser',
                getBrowser: sinon.stub().returns({
                    sessionId: sessionId || 'default-session-id'
                })
            }
        });
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
    testTranslateEvent_('fail', 'failTest');
    testTranslateEvent_('pending', 'pendingTest');

    it('should translate test data from mocha', function() {
        createReporter_();

        runner.emit('suite', {foo: 'bar'});

        assert.calledWithMatch(emit, 'beginSuite', {
            foo: 'bar'
        });
    });

    it('should add `browserId` and `sessionId` ', function() {
        createReporter_('browserId', 'mySessionId');

        runner.emit('suite', {foo: 'bar'});

        assert.calledWithMatch(emit, 'beginSuite', {
            browserId: 'browserId',
            sessionId: 'mySessionId'
        });
    });

    it('should append info about error to test data on suite fail', function() {
        createReporter_();

        runner.emit('fail', {}, {message: 'foo'});

        assert.calledWithMatch(emit, 'failTest', {
            err: {message: 'foo'}
        });
    });
});
