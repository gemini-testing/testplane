'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const ExecutionThread = require('lib/worker/runner/test-runner/execution-thread');
const OneTimeScreenshooter = require('lib/worker/runner/test-runner/one-time-screenshooter');
const {Suite, Test, Runnable} = require('../../../_mocha');

describe('worker/runner/test-runner/execution-thread', () => {
    const sandbox = sinon.sandbox.create();

    const mkTest_ = (opts = {}) => {
        opts.fn = opts.fn || sinon.spy();
        return Test.create(Suite.create(), opts);
    };

    const mkRunnable_ = (opts = {}) => {
        opts.type = opts.type || 'default-runnable-type';
        opts.fn = opts.fn || sinon.spy();
        return Runnable.create(Suite.create(), opts);
    };

    const mkBrowser_ = () => {
        return {
            publicAPI: Object.create({})
        };
    };

    const mkExecutionThread_ = (opts = {}) => {
        const test = opts.test || mkTest_();
        const browser = opts.browser || mkBrowser_();
        const hermioneCtx = opts.hermioneCtx || {};
        const screenshooter = opts.screenshooter || Object.create(OneTimeScreenshooter.prototype);

        return ExecutionThread.create({test, browser, hermioneCtx, screenshooter});
    };

    beforeEach(() => {
        sandbox.stub(OneTimeScreenshooter.prototype, 'extendWithPageScreenshot').callsFake((e) => Promise.resolve(e));
    });

    afterEach(() => sandbox.restore());

    describe('run', () => {
        it('should reject on runnable reject', async () => {
            const runnable = mkRunnable_({
                fn: () => Promise.reject(new Error('foo'))
            });
            const executionThread = mkExecutionThread_();

            await assert.isRejected(executionThread.run(runnable), /foo/);
        });

        it('should set browser public API to runnable fn context', async () => {
            const browser = mkBrowser_();
            const runnable = mkRunnable_();

            await mkExecutionThread_({browser}).run(runnable);

            assert.calledOn(runnable.fn, sinon.match({browser: browser.publicAPI}));
        });

        it('should run all runnables on the same context', async () => {
            const firstRunnable = mkRunnable_();
            const secondRunnable = mkRunnable_();

            const executionThread = mkExecutionThread_();

            await executionThread.run(firstRunnable);
            await executionThread.run(secondRunnable);

            assert.equal(
                firstRunnable.fn.firstCall.thisValue,
                secondRunnable.fn.firstCall.thisValue
            );
        });

        it('should set current test to runnable fn context', async () => {
            const test = mkTest_({title: 'some test'});
            const executionThread = mkExecutionThread_({test});

            const runnable = mkRunnable_();

            await executionThread.run(runnable);

            assert.calledOn(runnable.fn, sinon.match({currentTest: {title: 'some test'}}));
        });

        it('should set runnable as browser execution context', async () => {
            let executionContext;
            const runnable = mkRunnable_({
                title: 'some hook',
                fn: function() {
                    executionContext = this.browser.executionContext;
                }
            });

            await mkExecutionThread_().run(runnable);

            assert.propertyVal(executionContext, 'title', 'some hook');
        });

        it('should set runnable ctx to browser execution context', async () => {
            let _this;
            let executionContext;
            const runnable = mkRunnable_({
                fn: function() {
                    _this = this;
                    executionContext = this.browser.executionContext;
                }
            });

            await mkExecutionThread_().run(runnable);

            assert.propertyVal(executionContext, 'ctx', _this);
        });

        it('should share hermioneCtx in browser execution context between all runnables', async () => {
            const hermioneCtx = {};
            const executionThread = mkExecutionThread_({hermioneCtx});

            await executionThread.run(mkRunnable_({
                fn: function() {
                    this.browser.executionContext.hermioneCtx.foo = 'bar';
                }
            }));
            await executionThread.run(mkRunnable_({
                fn: function() {
                    this.browser.executionContext.hermioneCtx.baz = 'qux';
                }
            }));

            assert.deepEqual(hermioneCtx, {foo: 'bar', baz: 'qux'});
        });

        it('should fail with timeout error on timeout', async () => {
            const runnable = mkRunnable_({
                type: 'test',
                title: 'bla bla',
                fn: () => Promise.delay(20)
            });
            runnable.timeout(10);

            const executionThread = mkExecutionThread_();

            await assert.isRejected(executionThread.run(runnable), /test '.* bla bla' timed out/);
        });

        it('should not set timeout if timeouts are disabled', async () => {
            const runnable = mkRunnable_({
                type: 'test',
                fn: () => Promise.delay(20)
            });
            runnable.timeout(10);
            runnable.enableTimeouts(false);

            const executionThread = mkExecutionThread_();

            await assert.isFulfilled(executionThread.run(runnable));
        });

        describe('screenshotOnReject', () => {
            it('should extend error with page screenshot', async () => {
                const error = new Error();
                const runnable = mkRunnable_({
                    fn: () => Promise.reject(error)
                });

                OneTimeScreenshooter.prototype.extendWithPageScreenshot
                    .withArgs(error).callsFake((e) => {
                        return Promise.resolve(_.extend(e, {screenshot: 'base64img'}));
                    });

                const err = await mkExecutionThread_().run(runnable)
                    .catch((e) => e);

                assert.propertyVal(err, 'screenshot', 'base64img');
            });

            it('should wait until screenshot will be taken', async () => {
                const afterScreenshot = sinon.spy().named('afterScreenshot');
                OneTimeScreenshooter.prototype.extendWithPageScreenshot
                    .callsFake(() => Promise.delay(10).then(afterScreenshot));

                const runnable = mkRunnable_({
                    fn: () => Promise.reject(new Error())
                });

                await mkExecutionThread_().run(runnable).catch(() => {});

                assert.calledOnce(afterScreenshot);
            });

            it('runnable should not faile with timeout while taking screenshot', async () => {
                const runnable = mkRunnable_({
                    fn: () => Promise.reject(new Error('foo'))
                });
                runnable.timeout(10);

                OneTimeScreenshooter.prototype.extendWithPageScreenshot
                    .callsFake(() => Promise.delay(20));

                const executionThread = mkExecutionThread_();

                await assert.isRejected(executionThread.run(runnable), /foo/);
            });
        });
    });
});
