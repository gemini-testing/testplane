'use strict';

const chalk = require('chalk');
const path = require('path');
const EventEmitter = require('events').EventEmitter;
const FlatReporter = require('lib/reporters/flat');
const RunnerEvents = require('lib/constants/runner-events');
const logger = require('lib/utils/logger');
const mkTestStub_ = require('./utils').mkTestStub_;
const getDeserializedResult = require('./utils').getDeserializedResult;

describe('Flat reporter', () => {
    const sandbox = sinon.sandbox.create();

    let test;
    let emitter;
    let stdout;

    const emit = (event, data) => {
        emitter.emit(RunnerEvents.RUNNER_START);
        if (event) {
            emitter.emit(event, data);
        }
        emitter.emit(RunnerEvents.RUNNER_END, {});
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

    it('should print statistics of the tests execution', () => {
        emit(RunnerEvents.RUNNER_END, {
            total: 5,
            passed: 2,
            failed: 2,
            skipped: 1,
            retries: 2
        });

        const deserealizedResult = chalk.stripColor(logger.log.firstCall.args[0]);

        assert.equal(deserealizedResult, 'Total: 5 Passed: 2 Failed: 2 Skipped: 1 Retries: 2');
    });

    describe('rendering', () => {
        const testStates = {
            RETRY: 'retried',
            TEST_FAIL: 'failed'
        };

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

        ['RETRY', 'TEST_FAIL'].forEach((event) => {
            describe(`${testStates[event]} tests report`, () => {
                it(`should log correct number of ${testStates[event]} suite`, () => {
                    test = mkTestStub_();

                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /1\) .+/);
                });

                it(`should log full title of ${testStates[event]} suite`, () => {
                    test = mkTestStub_();

                    emit(RunnerEvents[event], test);

                    assert.include(stdout, test.fullTitle());
                });

                it(`should log path to file of ${testStates[event]} suite`, () => {
                    test = mkTestStub_();

                    sandbox.stub(path, 'relative').returns(`relative/${test.file}`);

                    emit(RunnerEvents[event], test);

                    assert.include(stdout, test.file);
                });

                it(`should log browser of ${testStates[event]} suite`, () => {
                    test = mkTestStub_({
                        browserId: 'bro1'
                    });

                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /bro1/);
                });

                it(`should log an error stack of ${testStates[event]} test`, () => {
                    test = mkTestStub_({
                        err: {stack: 'some stack'}
                    });

                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /some stack/);
                });

                it(`should log an error message of ${testStates[event]} test if an error stack does not exist`, () => {
                    test = mkTestStub_({
                        err: {message: 'some message'}
                    });

                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /some message/);
                });

                it(`should log an error of ${testStates[event]} test if an error stack and message do not exist`, () => {
                    test = mkTestStub_({
                        err: 'some error'
                    });

                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /some error/);
                });

                it('should extend error with original selenium error if it exist', () => {
                    test = mkTestStub_({
                        err: {
                            stack: 'some stack',
                            seleniumStack: {
                                orgStatusMessage: 'some original message'
                            }
                        }
                    });

                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /some stack \(some original message\)/);
                });

                it(`should log "undefined" if ${testStates[event]} test does not have "err" property`, () => {
                    test = mkTestStub_();

                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /undefined/);
                });
            });
        });

        describe('failed tests report', () => {
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
        });
    });
});
