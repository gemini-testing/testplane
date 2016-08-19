'use strict';

var _ = require('lodash'),
    EventEmitter = require('events').EventEmitter,
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

        assert.calledWith(logger.log, 'foo');
    });

    it('should print warning', function() {
        emit(RunnerEvents.WARNING, 'foo');

        assert.calledWith(logger.warn, 'foo');
    });

    it('should print error', function() {
        emit(RunnerEvents.ERROR, 'foo');

        assert.calledWith(logger.error, chalk.red('foo'));
    });

    describe('rendering', () => {
        const mkTestStub_ = (opts) => {
            return _.defaults(opts || {}, {
                fullTitle: sinon.stub().returns('suite test'),
                title: 'test',
                browserId: 'chrome',
                duration: '100500'
            });
        };
        const getDeserealizedResult = (log) => {
            return chalk
                .stripColor(log)
                .substr(2); // remove first symbol (icon)
        };

        it('should correctly do the rendering', function() {
            test = mkTestStub_({sessionId: 'test_session'});

            emit(RunnerEvents.TEST_PASS, test);

            const result = getDeserealizedResult(logger.log.firstCall.args[0]);

            assert.equal(result, 'suite test [chrome:test_session] - 100500ms');
        });

        it('should add skip comment if test was skipped', function() {
            test = mkTestStub_({
                pending: true,
                skipReason: 'some comment'
            });

            emit(RunnerEvents.TEST_PENDING, test);

            const result = getDeserealizedResult(logger.log.firstCall.args[0]);

            assert.equal(result, 'suite test [chrome] - 100500ms reason: some comment');
        });

        it('should use parent skip comment if all describe was skipped', function() {
            test = mkTestStub_({
                pending: true,
                skipReason: 'test comment',
                parent: {
                    skipReason: 'suite comment'
                }
            });

            emit(RunnerEvents.TEST_PENDING, test);

            const result = getDeserealizedResult(logger.log.firstCall.args[0]);

            assert.match(result, /reason: suite comment/);
        });

        it('should use test skip comment if describe was skipped without comment', function() {
            test = mkTestStub_({
                pending: true,
                skipReason: 'test comment',
                parent: {some: 'data'}
            });

            emit(RunnerEvents.TEST_PENDING, test);

            const result = getDeserealizedResult(logger.log.firstCall.args[0]);

            assert.equal(result, 'suite test [chrome] - 100500ms reason: test comment');
            assert.match(result, /reason: test comment/);
        });

        it('should use default message if test was skipped without comment', function() {
            test = mkTestStub_({
                pending: true
            });

            emit(RunnerEvents.TEST_PENDING, test);

            const result = getDeserealizedResult(logger.log.firstCall.args[0]);

            assert.match(result, /reason: no comment/);
        });
    });
});
