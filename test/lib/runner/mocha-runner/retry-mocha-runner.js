'use strict';

const EventEmitter = require('events').EventEmitter;
const RunnerEvents = require('../../../../lib/constants/runner-events');
const RetryMochaRunner = require('../../../../lib/runner/mocha-runner/retry-mocha-runner');
const TestStub = require('../../_mocha/test');
const Runnable = require('../../_mocha/runnable');

describe('mocha-runner/retry-mocha-runner', () => {
    const sandbox = sinon.sandbox.create();

    let mochaAdapter;

    const createMochaAdapter = () => {
        const mochaAdapter = new EventEmitter();

        mochaAdapter.run = sinon.stub().callsFake(() => Promise.resolve());
        mochaAdapter.reinit = sinon.stub().returnsThis();
        mochaAdapter.attachTestFilter = sinon.stub().returnsThis();
        mochaAdapter.reloadFiles = sinon.stub();

        return mochaAdapter;
    };

    const createRetryMochaRunner = (config) => RetryMochaRunner.create(mochaAdapter, config);
    const createTestStub = (title) => new TestStub({title: ''}, {title});
    const createRunnableStub = (parent) => new Runnable(parent);

    const emitEvent = (event, arg1, arg2) => {
        return () => {
            mochaAdapter.emit(event, arg1, arg2);
            return Promise.resolve();
        };
    };

    beforeEach(() => mochaAdapter = createMochaAdapter());
    afterEach(() => sandbox.restore());

    describe('run', () => {
        describe('on test fail', () => {
            it('should emit "TEST_FAIL" event if no retries were set', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 0});
                const onTestFail = sinon.spy().named('onTestFail');
                const test = createTestStub();

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL, test));
                retryMochaRunner.on(RunnerEvents.TEST_FAIL, onTestFail);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onTestFail, test));
            });

            it('should emit "RETRY" event if retries were set', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onTestRetry = sinon.spy().named('onTestRetry');
                const test = createTestStub();

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL, test));
                retryMochaRunner.on(RunnerEvents.RETRY, onTestRetry);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onTestRetry, test));
            });

            it('should extend runnable with the count of retries left on "RETRY" event', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onTestRetry = sinon.spy().named('onTestRetry');
                const test = createTestStub();

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL, test));
                retryMochaRunner.on(RunnerEvents.RETRY, onTestRetry);

                return retryMochaRunner.run()
                    .then(() => assert.calledWithMatch(onTestRetry, {retriesLeft: 0}));
            });

            it('should emit "TEST_FAIL" event if no retries left', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onTestFail = sinon.spy().named('onTestFail');
                const test = createTestStub();

                mochaAdapter.run.onFirstCall().callsFake(emitEvent(RunnerEvents.TEST_FAIL, test));
                mochaAdapter.run.onSecondCall().callsFake(emitEvent(RunnerEvents.TEST_FAIL, test));
                retryMochaRunner.on(RunnerEvents.TEST_FAIL, onTestFail);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onTestFail, test));
            });

            it('should not emit "TEST_FAIL" event if a test passed after retries', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onTestFail = sinon.spy().named('onTestFail');
                const test = createTestStub();

                mochaAdapter.run.onFirstCall().callsFake(emitEvent(RunnerEvents.TEST_FAIL, test));
                mochaAdapter.run.onSecondCall().callsFake(emitEvent(RunnerEvents.TEST_PASS, test));
                retryMochaRunner.on(RunnerEvents.TEST_FAIL, onTestFail);

                return retryMochaRunner.run()
                    .then(() => assert.notCalled(onTestFail));
            });

            it('should submit for retry failed tests', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const test = createTestStub('some-test');

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL, test));
                mochaAdapter.reloadFiles.callsFake(() => {
                    const filterFn = mochaAdapter.attachTestFilter.lastCall.args[0];

                    assert.isTrue(filterFn(test));
                    assert.isFalse(filterFn(createTestStub('another-test')));
                });

                return retryMochaRunner.run();
            });

            it('should reinit mocha → attach test filter → reload files before a retry', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL, createTestStub()));

                return retryMochaRunner.run()
                    .then(() => {
                        assert.callOrder(
                            mochaAdapter.reinit,
                            mochaAdapter.attachTestFilter,
                            mochaAdapter.reloadFiles,
                            mochaAdapter.run
                        );
                    });
            });
        });

        describe('on error', () => {
            it('should emit "ERROR" event if no runnable passed', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onErr = sinon.spy().named('onErr');

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err'));
                retryMochaRunner.on(RunnerEvents.ERROR, onErr);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onErr, 'err'));
            });

            it('should emit "ERROR" event if a failed runnable does not have a parent', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onErr = sinon.spy().named('onErr');
                const runnable = createRunnableStub();

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));
                retryMochaRunner.on(RunnerEvents.ERROR, onErr);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onErr, 'err', runnable));
            });

            it('should emit "ERROR" event if no retries were set', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 0});
                const onErr = sinon.spy().named('onErr');
                const runnable = createTestStub({});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));
                retryMochaRunner.on(RunnerEvents.ERROR, onErr);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onErr, 'err', runnable));
            });

            it('should emit "RETRY" event if retries were set', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onRetry = sinon.spy().named('onRetry');
                const runnable = createRunnableStub({});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));
                retryMochaRunner.on(RunnerEvents.RETRY, onRetry);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onRetry, runnable));
            });

            it('should extend runnable with an err and the count of retries left on "RETRY" event', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onRetry = sinon.spy().named('onRetry');

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', createRunnableStub({})));
                retryMochaRunner.on(RunnerEvents.RETRY, onRetry);

                return retryMochaRunner.run()
                    .then(() => assert.calledWithMatch(onRetry, {err: 'err', retriesLeft: 0}));
            });

            it('should emit "ERROR" event if no retries left', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onErr = sinon.spy().named('onErr');
                const runnable = createRunnableStub({tests: [createTestStub()]});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));
                retryMochaRunner.on(RunnerEvents.ERROR, onErr);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onErr, 'err', runnable));
            });

            it('should not emit "ERROR" event if it does not appear after retries', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onErr = sinon.spy().named('onErr');
                const runnable = createRunnableStub({tests: [createTestStub()]});

                mochaAdapter.run.onFirstCall().callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));
                retryMochaRunner.on(RunnerEvents.ERROR, onErr);

                return retryMochaRunner.run()
                    .then(() => assert.notCalled(onErr));
            });

            it('should submit for retry a parent of a failed runnable', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const test1 = createTestStub('first-test');
                const test2 = createTestStub('second-test');
                const runnable = createRunnableStub({tests: [test1], suites: [{tests: [test2]}]});

                mochaAdapter.reloadFiles.callsFake(() => {
                    const filterFn = mochaAdapter.attachTestFilter.lastCall.args[0];

                    assert.isTrue(filterFn(test1));
                    assert.isTrue(filterFn(test2));
                    assert.isFalse(filterFn(createTestStub('another-test')));
                });
                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));

                return retryMochaRunner.run();
            });

            it('should reinit mocha → attach test filter → reload files before a retry', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const runnable = createRunnableStub({tests: [createTestStub()]});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));

                return retryMochaRunner.run()
                    .then(() => {
                        assert.callOrder(
                            mochaAdapter.reinit,
                            mochaAdapter.attachTestFilter,
                            mochaAdapter.reloadFiles,
                            mochaAdapter.run
                        );
                    });
            });
        });
    });
});
