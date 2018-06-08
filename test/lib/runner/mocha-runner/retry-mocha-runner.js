'use strict';

const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
const RunnerEvents = require('lib/constants/runner-events');
const RetryMochaRunner = require('lib/runner/mocha-runner/retry-mocha-runner');
const NoRefImageError = require('lib/browser/commands/assert-view/errors/no-ref-image-error');
const TestStub = require('../../_mocha/test');
const Runnable = require('../../_mocha/runnable');

describe('mocha-runner/retry-mocha-runner', () => {
    const sandbox = sinon.sandbox.create();

    let mochaAdapter;

    const createMochaAdapter = () => {
        const mochaAdapter = new EventEmitter();

        mochaAdapter.run = sinon.stub().callsFake(() => Promise.resolve({}));
        mochaAdapter.reinit = sinon.stub();

        return mochaAdapter;
    };

    const createRetryMochaRunner = (config) => RetryMochaRunner.create(mochaAdapter, config);
    const createTestStub = (title) => new TestStub({title: ''}, {title});
    const createRunnableStub = (parent) => new Runnable(parent);

    const emitEvent = (event, arg1, arg2) => {
        return () => {
            mochaAdapter.emit(event, arg1, arg2);
            return Promise.resolve({failed: _.includes([RunnerEvents.TEST_FAIL, RunnerEvents.ERROR], event)});
        };
    };

    beforeEach(() => mochaAdapter = createMochaAdapter());
    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should provide the ability to mutate the passed config', () => {
            const config = {retry: 1};
            const retryMochaRunner = createRetryMochaRunner(config);

            mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL, createTestStub()));

            config.retry = 0;

            return retryMochaRunner.run()
                .then(() => assert.calledOnce(mochaAdapter.run));
        });
    });

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

            it('should not retry if no retries were set', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 0});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL, createTestStub()));

                return retryMochaRunner.run({some: 'workers'})
                    .then(() => assert.calledOnceWith(mochaAdapter.run, {some: 'workers'}));
            });

            it('should emit "TEST_FAIL" event if retries count is below zero', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: -1});
                const onTestFail = sinon.spy().named('onTestFail');
                const test = createTestStub();

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL, test));
                retryMochaRunner.on(RunnerEvents.TEST_FAIL, onTestFail);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onTestFail, test));
            });

            it('should not retry if retries count is below zero', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: -1});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL));

                return retryMochaRunner.run({some: 'workers'})
                    .then(() => assert.calledOnceWith(mochaAdapter.run, {some: 'workers'}));
            });

            it('should not retry if retries left and shouldRetry() told so', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 10, shouldRetry: () => false});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL));

                return retryMochaRunner.run({some: 'workers'})
                    .then(() => assert.calledOnceWith(mochaAdapter.run, {some: 'workers'}));
            });

            it('should not retry if there are no reference image for test', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 10});
                const test = {assertViewResults: [{foo: 'bar'}, new NoRefImageError()]};

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL, test));

                return retryMochaRunner.run({some: 'workers'})
                    .then(() => assert.calledOnceWith(mochaAdapter.run, {some: 'workers'}));
            });

            it('shouldRetry() should have proper argument', () => {
                const rule = sandbox.spy();
                const retryMochaRunner = createRetryMochaRunner({retry: 1, shouldRetry: rule});
                const error = {some: 'value'};

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL, error));

                return retryMochaRunner.run()
                    .then(() => {
                        const arg = rule.args[0][0];
                        assert.equal(rule.args[0].length, 1, 'shouldRetry() expect one argument');
                        assert.equal(arg.retriesLeft, 1, 'shouldRetry() have context with "retriesLeft" field');
                        assert.equal(arg.ctx, error, 'shouldRetry() have context with error data as "ctx" field');
                    });
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

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL, createTestStub()));
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

                mochaAdapter.run.onFirstCall().callsFake(emitEvent(RunnerEvents.TEST_FAIL));
                mochaAdapter.run.onSecondCall().callsFake(emitEvent(RunnerEvents.TEST_PASS));
                retryMochaRunner.on(RunnerEvents.TEST_FAIL, onTestFail);

                return retryMochaRunner.run()
                    .then(() => assert.notCalled(onTestFail));
            });

            it('should submit for retry a failed mocha', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL));

                return retryMochaRunner.run({some: 'workers'})
                    .then(() => {
                        assert.calledTwice(mochaAdapter.run);
                        assert.alwaysCalledWith(mochaAdapter.run, {some: 'workers'});
                    });
            });

            it('should reinit mocha before a retry', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.TEST_FAIL));

                return retryMochaRunner.run()
                    .then(() => assert.callOrder(mochaAdapter.reinit, mochaAdapter.run));
            });
        });

        describe('on error', () => {
            it('should emit "ERROR" event if no runnable passed', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onErr = sinon.spy().named('onErr');

                mochaAdapter.run.onFirstCall().callsFake(emitEvent(RunnerEvents.ERROR, 'err'));
                retryMochaRunner.on(RunnerEvents.ERROR, onErr);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onErr, 'err'));
            });

            it('should not retry if no runnable passed', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err'));

                return retryMochaRunner.run()
                    .then(() => assert.calledOnce(mochaAdapter.run));
            });

            it('should emit "ERROR" event if a failed runnable does not have a parent', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onErr = sinon.spy().named('onErr');
                const runnable = createRunnableStub();

                mochaAdapter.run.onFirstCall().callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));
                retryMochaRunner.on(RunnerEvents.ERROR, onErr);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onErr, 'err', runnable));
            });

            it('should not retry if a failed runnable does not have a parent', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', createRunnableStub()));

                return retryMochaRunner.run()
                    .then(() => assert.calledOnce(mochaAdapter.run));
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

            it('should not retry if no retries were set', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 0});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', createTestStub({})));

                return retryMochaRunner.run()
                    .then(() => assert.calledOnce(mochaAdapter.run));
            });

            it('should emit "ERROR" event if retries count is below zero', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: -1});
                const onErr = sinon.spy().named('onErr');
                const runnable = createTestStub({});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));
                retryMochaRunner.on(RunnerEvents.ERROR, onErr);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onErr, 'err', runnable));
            });

            it('should not retry if retries left and shouldRetry() told so', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 10, shouldRetry: () => false});
                const onErr = sinon.spy().named('onErr');
                const runnable = createTestStub({});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));
                retryMochaRunner.on(RunnerEvents.ERROR, onErr);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onErr, 'err', runnable));
            });

            it('shouldRetry() should have proper argument', () => {
                const rule = sandbox.spy();
                const retryMochaRunner = createRetryMochaRunner({retry: 1, shouldRetry: rule});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', createRunnableStub({})));

                return retryMochaRunner.run()
                    .then(() => {
                        const arg = rule.args[0][0];
                        assert.equal(rule.args[0].length, 1, 'shouldRetry() expect one arguments');
                        assert.equal(arg.retriesLeft, 1, 'shouldRetry() have context with "retriesLeft" field');
                        assert.equal(arg.error, 'err', 'shouldRetry() have context with "error" field');
                        assert.instanceOf(arg.ctx, Runnable, 'shouldRetry() have context with Runnable as "ctx" field');
                    });
            });

            it('should not retry if retries count is below zero', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: -1});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', createTestStub({})));

                return retryMochaRunner.run()
                    .then(() => assert.calledOnce(mochaAdapter.run));
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
                const runnable = createRunnableStub({});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));
                retryMochaRunner.on(RunnerEvents.ERROR, onErr);

                return retryMochaRunner.run()
                    .then(() => assert.calledOnceWith(onErr, 'err', runnable));
            });

            it('should not emit "ERROR" event if it does not appear after retries', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});
                const onErr = sinon.spy().named('onErr');
                const runnable = createRunnableStub({});

                mochaAdapter.run.onFirstCall().callsFake(emitEvent(RunnerEvents.ERROR, 'err', runnable));
                retryMochaRunner.on(RunnerEvents.ERROR, onErr);

                return retryMochaRunner.run()
                    .then(() => assert.notCalled(onErr));
            });

            it('should submit for retry a failed mocha', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', createRunnableStub({})));

                return retryMochaRunner.run()
                    .then(() => assert.calledTwice(mochaAdapter.run));
            });

            it('should reinit mocha before a retry', () => {
                const retryMochaRunner = createRetryMochaRunner({retry: 1});

                mochaAdapter.run.callsFake(emitEvent(RunnerEvents.ERROR, 'err', createRunnableStub({})));

                return retryMochaRunner.run()
                    .then(() => assert.callOrder(mochaAdapter.reinit, mochaAdapter.run));
            });
        });
    });
});
