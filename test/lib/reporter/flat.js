'use strict';

const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
const FlatReporter = require('../../../lib/reporters/flat');
const RunnerEvents = require('../../../lib/constants/runner-events');
const logger = require('../../../lib/utils').logger;
const chalk = require('chalk');

describe('Flat reporter', () => {
    const sandbox = sinon.sandbox.create();

    let test;
    let emitter;

    const getCounters_ = (args) => {
        return {
            total: chalk.stripColor(args[1]),
            passed: chalk.stripColor(args[2]),
            failed: chalk.stripColor(args[3]),
            pending: chalk.stripColor(args[4]),
            retries: chalk.stripColor(args[5])
        };
    };

    const emit = (event, data) => {
        emitter.emit(RunnerEvents.RUNNER_START);
        if (event) {
            emitter.emit(event, data);
        }
        emitter.emit(RunnerEvents.RUNNER_END);
    };

    beforeEach(() => {
        test = {
            fullTitle: sinon.stub().returns('foo bar baz'),
            title: 'baz',
            browserId: 0,
            sessionId: 'some_session_id',
            duration: 100500
        };

        const reporter = new FlatReporter();

        emitter = new EventEmitter();
        reporter.attachRunner(emitter);
        sandbox.stub(logger);
    });

    afterEach(() => {
        sandbox.restore();
        emitter.removeAllListeners();
    });

    it('should initialize counters with 0', () => {
        emit();

        const counters = getCounters_(logger.log.lastCall.args);

        assert.equal(counters.total, 0);
        assert.equal(counters.passed, 0);
        assert.equal(counters.failed, 0);
        assert.equal(counters.pending, 0);
        assert.equal(counters.retries, 0);
    });

    describe('should correctly calculate counters for', () => {
        it('successed', () => {
            emit(RunnerEvents.TEST_PASS, test);

            const counters = getCounters_(logger.log.lastCall.args);

            assert.equal(counters.passed, 1);
        });

        it('failed', () => {
            emit(RunnerEvents.TEST_FAIL, test);

            const counters = getCounters_(logger.log.lastCall.args);

            assert.equal(counters.failed, 1);
        });

        it('pending', () => {
            emit(RunnerEvents.TEST_PENDING, test);

            const counters = getCounters_(logger.log.lastCall.args);

            assert.equal(counters.pending, 1);
        });

        it('retries', () => {
            emit(RunnerEvents.RETRY, test);

            const counters = getCounters_(logger.log.lastCall.args);

            assert.equal(counters.retries, 1);
        });
    });

    it('should print info', () => {
        emit(RunnerEvents.INFO, 'foo');

        assert.calledWith(logger.log, 'foo');
    });

    it('should print warning', () => {
        emit(RunnerEvents.WARNING, 'foo');

        assert.calledWith(logger.warn, 'foo');
    });

    it('should print error', () => {
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

        it('should correctly do the rendering', () => {
            test = mkTestStub_({sessionId: 'test_session'});

            emit(RunnerEvents.TEST_PASS, test);

            const result = getDeserealizedResult(logger.log.firstCall.args[0]);

            assert.equal(result, 'suite test [chrome:test_session] - 100500ms');
        });

        it('should add skip comment if test was skipped', () => {
            test = mkTestStub_({
                pending: true,
                skipReason: 'some comment'
            });

            emit(RunnerEvents.TEST_PENDING, test);

            const result = getDeserealizedResult(logger.log.firstCall.args[0]);

            assert.equal(result, 'suite test [chrome] - 100500ms reason: some comment');
        });

        it('should use parent skip comment if all describe was skipped', () => {
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

        it('should use test skip comment if describe was skipped without comment', () => {
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

        it('should use default message if test was skipped without comment', () => {
            test = mkTestStub_({
                pending: true
            });

            emit(RunnerEvents.TEST_PENDING, test);

            const result = getDeserealizedResult(logger.log.firstCall.args[0]);

            assert.match(result, /reason: no comment/);
        });
    });
});
