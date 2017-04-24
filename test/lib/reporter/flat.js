'use strict';

const chalk = require('chalk');
const path = require('path');
const EventEmitter = require('events').EventEmitter;
const FlatReporter = require('../../../lib/reporters/flat');
const RunnerEvents = require('../../../lib/constants/runner-events');
const logger = require('../../../lib/utils').logger;
const mkTestStub_ = require('./utils').mkTestStub_;
const getDeserializedResult = require('./utils').getDeserializedResult;

describe('Flat reporter', () => {
    const sandbox = sinon.sandbox.create();

    let test;
    let emitter;
    let stdout;

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
        test = mkTestStub_();

        const reporter = new FlatReporter();

        emitter = new EventEmitter();
        reporter.attachRunner(emitter);

        stdout = '';
        sandbox.stub(logger, 'log').callsFake((str) => stdout += `${str}\n`);

        sandbox.stub(logger, 'warn');
        sandbox.stub(logger, 'error');
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

            const counters = getCounters_(logger.log.secondCall.args);

            assert.equal(counters.failed, 1);
        });

        it('pending', () => {
            emit(RunnerEvents.TEST_PENDING, test);

            const counters = getCounters_(logger.log.lastCall.args);

            assert.equal(counters.pending, 1);
        });

        it('retries', () => {
            emit(RunnerEvents.RETRY, test);

            const counters = getCounters_(logger.log.thirdCall.args);

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
        it('should correctly do the rendering', () => {
            test = mkTestStub_({sessionId: 'test_session'});

            emit(RunnerEvents.TEST_PASS, test);

            const result = getDeserializedResult(logger.log.firstCall.args[0]);

            assert.equal(result, 'suite test [chrome:test_session] - 100500ms');
        });

        describe('skipped tests report', () => {
            it('should add skip comment if test was skipped', () => {
                test = mkTestStub_({
                    pending: true,
                    skipReason: 'some comment'
                });

                emit(RunnerEvents.TEST_PENDING, test);

                const result = getDeserializedResult(logger.log.firstCall.args[0]);

                assert.match(result, /reason: some comment/);
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

                const result = getDeserializedResult(logger.log.firstCall.args[0]);

                assert.match(result, /reason: suite comment/);
            });

            it('should use test skip comment if describe was skipped without comment', () => {
                test = mkTestStub_({
                    pending: true,
                    skipReason: 'test comment',
                    parent: {some: 'data'}
                });

                emit(RunnerEvents.TEST_PENDING, test);

                const result = getDeserializedResult(logger.log.firstCall.args[0]);

                assert.match(result, /reason: test comment/);
            });

            it('should use default message if test was skipped without comment', () => {
                test = mkTestStub_({
                    pending: true
                });

                emit(RunnerEvents.TEST_PENDING, test);

                const result = getDeserializedResult(logger.log.firstCall.args[0]);

                assert.match(result, /reason: no comment/);
            });
        });

        describe('failed tests report', () => {
            it('should log correct number of failed suite', () => {
                test = mkTestStub_();

                emit(RunnerEvents.TEST_FAIL, test);

                assert.match(stdout, /\n1\) .+/);
            });

            it('should log full title of failed suite', () => {
                test = mkTestStub_();

                emit(RunnerEvents.TEST_FAIL, test);

                assert.include(stdout, test.fullTitle());
            });

            it('should log path to file of failed suite', () => {
                test = mkTestStub_();

                sandbox.stub(path, 'relative').returns(`relative/${test.file}`);

                emit(RunnerEvents.TEST_FAIL, test);

                assert.include(stdout, test.file);
            });

            it('should log path to file of failed hook', () => {
                test = mkTestStub_({
                    file: null,
                    parent: {
                        file: 'path-to-test'
                    }
                });

                sandbox.stub(path, 'relative').returns(`relative/${test.parent.file}`);

                emit(RunnerEvents.TEST_FAIL, test);

                assert.include(stdout, 'relative/path-to-test');
            });

            it('should not throw if path to file is not specified on failed hook', () => {
                test = mkTestStub_({
                    file: null,
                    parent: {}
                });

                assert.doesNotThrow(() => emit(RunnerEvents.TEST_FAIL, test));
            });

            it('should log browser of failed suite', () => {
                test = mkTestStub_({
                    browserId: 'bro1'
                });

                emit(RunnerEvents.TEST_FAIL, test);

                assert.match(stdout, /bro1/);
            });

            it('should log an error stack of failed test', () => {
                test = mkTestStub_({
                    err: {stack: 'some stack'}
                });

                emit(RunnerEvents.TEST_FAIL, test);

                assert.match(stdout, /some stack/);
            });

            it('should log an error message of failed test if an error stack does not exist', () => {
                test = mkTestStub_({
                    err: {message: 'some message'}
                });

                emit(RunnerEvents.TEST_FAIL, test);

                assert.match(stdout, /some message/);
            });

            it('should log an error of failed test if an error stack and message do not exist', () => {
                test = mkTestStub_({
                    err: 'some error'
                });

                emit(RunnerEvents.TEST_FAIL, test);

                assert.match(stdout, /some error/);
            });

            it('should log "undefined" if failed test does not have "err" property', () => {
                test = mkTestStub_();

                emit(RunnerEvents.TEST_FAIL, test);

                assert.match(stdout, /undefined/);
            });
        });

        describe('retried tests report', () => {
            it('should log correct number of retried suite', () => {
                test = mkTestStub_();

                emit(RunnerEvents.RETRY, test);

                assert.match(stdout, /1\) .+/);
            });

            it('should log full title of retried suite', () => {
                test = mkTestStub_();

                emit(RunnerEvents.RETRY, test);

                assert.include(stdout, test.fullTitle());
            });

            it('should log path to file of retried suite', () => {
                test = mkTestStub_();

                sandbox.stub(path, 'relative').returns(`relative/${test.file}`);

                emit(RunnerEvents.RETRY, test);

                assert.include(stdout, test.file);
            });

            it('should log browser of retried suite', () => {
                test = mkTestStub_({
                    browserId: 'bro1'
                });

                emit(RunnerEvents.RETRY, test);

                assert.match(stdout, /bro1/);
            });

            it('should log an error stack of retried test', () => {
                test = mkTestStub_({
                    err: {stack: 'some stack'}
                });

                emit(RunnerEvents.RETRY, test);

                assert.match(stdout, /some stack/);
            });

            it('should log an error message of retried test if an error stack does not exist', () => {
                test = mkTestStub_({
                    err: {message: 'some message'}
                });

                emit(RunnerEvents.RETRY, test);

                assert.match(stdout, /some message/);
            });

            it('should log an error of retried test if an error stack and message do not exist', () => {
                test = mkTestStub_({
                    err: 'some error'
                });

                emit(RunnerEvents.TEST_FAIL, test);

                assert.match(stdout, /some error/);
            });

            it('should log "undefined" if retried test does not have "err" property', () => {
                test = mkTestStub_();

                emit(RunnerEvents.TEST_FAIL, test);

                assert.match(stdout, /undefined/);
            });
        });
    });
});
