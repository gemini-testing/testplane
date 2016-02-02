'use strict';

var EventEmitter = require('events').EventEmitter,
    FlatReporter = require('../../../lib/reporters/flat'),
    RunnerEvents = require('../../../lib/constants/runner-events'),
    logger = require('../../../lib/utils').logger,
    chalk = require('chalk');

describe('Flat reporter', function() {
    var sandbox = sinon.sandbox.create(),
        test,
        emitter;

    function getCounters_(args) {
        return {
            total: chalk.stripColor(args[1]),
            passed: chalk.stripColor(args[2]),
            failed: chalk.stripColor(args[3]),
            pending: chalk.stripColor(args[4]),
            retries: chalk.stripColor(args[5])
        };
    }

    function emit(event, data) {
        emitter.emit(RunnerEvents.RUNNER_START);
        if (event) {
            emitter.emit(event, data);
        }
        emitter.emit(RunnerEvents.RUNNER_END);
    }

    beforeEach(function() {
        test = {
            fullTitle: sinon.stub().returns('foo bar baz'),
            title: 'baz',
            browserId: 0,
            sessionId: 'some_session_id',
            duration: 100500
        };

        var reporter = new FlatReporter();

        emitter = new EventEmitter();
        reporter.attachRunner(emitter);
        sandbox.stub(logger);
    });

    afterEach(function() {
        sandbox.restore();
        emitter.removeAllListeners();
    });

    it('should initialize counters with 0', function() {
        emit();

        var counters = getCounters_(logger.log.lastCall.args);

        assert.equal(counters.total, 0);
        assert.equal(counters.passed, 0);
        assert.equal(counters.failed, 0);
        assert.equal(counters.pending, 0);
        assert.equal(counters.retries, 0);
    });

    describe('should correctly calculate counters for', function() {
        it('successed', function() {
            emit(RunnerEvents.TEST_PASS, test);

            var counters = getCounters_(logger.log.lastCall.args);

            assert.equal(counters.passed, 1);
        });

        it('failed', function() {
            emit(RunnerEvents.TEST_FAIL, test);

            var counters = getCounters_(logger.log.lastCall.args);

            assert.equal(counters.failed, 1);
        });

        it('pending', function() {
            emit(RunnerEvents.TEST_PENDING, test);

            var counters = getCounters_(logger.log.lastCall.args);

            assert.equal(counters.pending, 1);
        });

        it('retries', function() {
            emit(RunnerEvents.RETRY, test);

            var counters = getCounters_(logger.log.lastCall.args);

            assert.equal(counters.retries, 1);
        });
    });

    it('should print info', function() {
        emit(RunnerEvents.INFO, 'foo');

        assert.called(logger.log, 'foo');
    });

    it('should print warning', function() {
        emit(RunnerEvents.WARNING, 'foo');

        assert.called(logger.warn, 'foo');
    });

    it('should print error', function() {
        emit(RunnerEvents.ERROR, 'foo');

        assert.called(logger.error, 'foo');
    });

    it('should correctly do the rendering', function() {
        test = {
            fullTitle: sinon.stub().returns('suite test'),
            title: 'test',
            browserId: 'chrome',
            sessionId: 'test_session',
            duration: '100500'
        };

        emit(RunnerEvents.TEST_PASS, test);

        var deserealizedResult = chalk
            .stripColor(logger.log.firstCall.args[0])
            .substr(2); // remove first symbol (icon)

        assert.equal(deserealizedResult, 'suite test [chrome:test_session] - 100500ms');
    });
});
