'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const TestRunner = require('lib/worker/runner/test-runner');
const HookRunner = require('lib/worker/runner/test-runner/hook-runner');
const ExecutionThread = require('lib/worker/runner/test-runner/execution-thread');
const OneTimeScreenshooter = require('lib/worker/runner/test-runner/one-time-screenshooter');
const BrowserAgent = require('lib/worker/runner/browser-agent');
const AssertViewError = require('lib/browser/commands/assert-view/errors/assert-view-error');
const AssertViewResults = require('lib/browser/commands/assert-view/assert-view-results');
const {makeConfigStub} = require('../../../../utils');
const {Suite, Test} = require('../../../_mocha');

describe('worker/runner/test-runner', () => {
    const sandbox = sinon.sandbox.create();

    const mkTest_ = (opts = {}) => {
        opts.fn = opts.fn || sinon.spy();
        return Test.create(Suite.create(), opts);
    };

    const mkRunner_ = (opts = {}) => {
        const test = opts.test || mkTest_();
        const config = opts.config || makeConfigStub();
        const browserAgent = opts.browserAgent || Object.create(BrowserAgent.prototype);

        return TestRunner.create(test, config, browserAgent);
    };

    const mkBrowser_ = (prototype = {}) => {
        const publicAPI = _.defaults(prototype, {
            moveToObject: sandbox.stub(),
            options: {deprecationWarnings: true}
        });

        return {
            publicAPI,
            meta: {},
            changes: {}
        };
    };

    beforeEach(() => {
        sandbox.stub(BrowserAgent.prototype, 'getBrowser').resolves(mkBrowser_());

        sandbox.stub(ExecutionThread, 'create').returns(Object.create(ExecutionThread.prototype));
        sandbox.stub(ExecutionThread.prototype, 'run').callsFake((runnable) => runnable.fn());

        sandbox.stub(HookRunner, 'create').returns(Object.create(HookRunner.prototype));
        sandbox.stub(HookRunner.prototype, 'runBeforeEachHooks').resolves();
        sandbox.stub(HookRunner.prototype, 'runAfterEachHooks').resolves();

        sandbox.stub(OneTimeScreenshooter, 'create').returns(Object.create(OneTimeScreenshooter.prototype));
    });

    afterEach(() => sandbox.restore());

    describe('run', () => {
        const run_ = (opts = {}) => {
            const test = opts.test || mkTest_();
            const runner = opts.runner || mkRunner_({test});

            return runner.run({});
        };

        it('should request browser for passed session', async () => {
            const runner = mkRunner_();

            await runner.run({sessionId: '100500'});

            assert.calledOnceWith(BrowserAgent.prototype.getBrowser, '100500');
        });

        it('should create one time screenshooter', async () => {
            const config = makeConfigStub();
            const runner = mkRunner_({config});

            const browser = mkBrowser_();
            BrowserAgent.prototype.getBrowser.resolves(browser);

            await run_({runner});

            assert.calledOnceWith(OneTimeScreenshooter.create, config, browser);
        });

        it('should create execution thread for test', async () => {
            const test = mkTest_();

            await run_({test});

            assert.calledOnceWith(ExecutionThread.create, sinon.match({test}));
        });

        it('should protect test from modification in execution thread', async () => {
            ExecutionThread.create.callsFake(({test}) => {
                test.foo = 'bar';
                return Object.create(ExecutionThread.prototype);
            });

            const test = mkTest_();
            await run_({test});

            assert.notProperty(test, 'foo');
        });

        it('should create execution thread with requested browser', async () => {
            const browser = mkBrowser_();
            BrowserAgent.prototype.getBrowser.resolves(browser);

            await run_();

            assert.calledOnceWith(ExecutionThread.create, sinon.match({browser}));
        });

        it('should create execution thread with empty hermioneCtx by default', async () => {
            await run_({});

            assert.calledOnceWith(ExecutionThread.create, sinon.match({hermioneCtx: {}}));
        });

        it('should create execution thread with test hermioneCtx', async () => {
            const test = mkTest_();
            test.hermioneCtx = {foo: 'bar'};

            await run_({test});

            assert.calledOnceWith(ExecutionThread.create, sinon.match({hermioneCtx: {foo: 'bar'}}));
        });

        it('test hermioneCtx should be protected from modification during run', async () => {
            ExecutionThread.create.callsFake(({hermioneCtx}) => {
                ExecutionThread.prototype.run.callsFake(() => {
                    hermioneCtx.baz = 'qux';
                });

                return Object.create(ExecutionThread.prototype);
            });

            const test = mkTest_();
            test.hermioneCtx = {foo: 'bar'};

            await run_({test});

            assert.deepEqual(test.hermioneCtx, {foo: 'bar'});
        });

        it('should create execution thread with screenshooter', async () => {
            const screenshooter = Object.create(OneTimeScreenshooter.prototype);
            OneTimeScreenshooter.create.returns(screenshooter);

            await run_();

            assert.calledOnceWith(ExecutionThread.create, sinon.match({screenshooter}));
        });

        it('should create hook runner for test with execution thread', async () => {
            const executionThread = Object.create(ExecutionThread.prototype);
            ExecutionThread.create.returns(executionThread);
            const test = mkTest_();

            await run_({test});

            assert.calledOnceWith(HookRunner.create, sinon.match(test), executionThread);
        });

        it('should run test in execution thread', async () => {
            const test = mkTest_();

            await run_({test});

            assert.calledOnceWith(ExecutionThread.prototype.run, sinon.match(test));
        });

        it('should protect test from modification during run in execution thread', async () => {
            ExecutionThread.prototype.run.callsFake((test) => test.foo = 'bar');

            const test = mkTest_();
            await run_({test});

            assert.notProperty(test, 'foo');
        });

        describe('cursor position', () => {
            it('should reset cursor position', async () => {
                const browser = mkBrowser_();
                BrowserAgent.prototype.getBrowser.resolves(browser);

                await run_();

                assert.calledOnceWith(browser.publicAPI.moveToObject, 'body', 0, 0);
            });

            it('should disable deprecation warnings when resetting position of the cursor', async () => {
                const browser = mkBrowser_();
                BrowserAgent.prototype.getBrowser.resolves(browser);

                let deprecationWarnings;
                browser.publicAPI.moveToObject.callsFake(() => ({deprecationWarnings} = browser.publicAPI.options));

                await run_();

                assert.isFalse(deprecationWarnings);
            });

            describe('should restore deprecation warnings', () => {
                it('after session is raised', async () => {
                    const browser = mkBrowser_();
                    BrowserAgent.prototype.getBrowser.resolves(browser);

                    await run_();

                    assert.isTrue(browser.publicAPI.options.deprecationWarnings);
                });

                it('if reset position of the cursor is failed', async () => {
                    const browser = mkBrowser_();
                    BrowserAgent.prototype.getBrowser.resolves(browser);
                    browser.publicAPI.moveToObject.rejects(new Error());

                    await run_().catch(() => {});

                    assert.isTrue(browser.publicAPI.options.deprecationWarnings);
                });
            });
        });

        describe('beforeEach hooks', () => {
            it('should be called before test hook', async () => {
                await run_();

                assert.calledOnce(HookRunner.prototype.runBeforeEachHooks);
            });

            it('should wait beforeEach hooks finish before running test', async () => {
                const afterBeforeEach = sinon.spy().named('afterBeforeEach');
                HookRunner.prototype.runBeforeEachHooks.callsFake(() => Promise.delay(10).then(afterBeforeEach));
                const test = mkTest_();

                await run_({test});

                assert.callOrder(afterBeforeEach, test.fn);
            });

            it('should not call test if beforeEach hooks failed', async () => {
                HookRunner.prototype.runBeforeEachHooks.rejects(new Error());
                const test = mkTest_();

                await run_({test}).catch(() => {});

                assert.notCalled(test.fn);
            });

            it('should reject with beforeEach hook error', async () => {
                HookRunner.prototype.runBeforeEachHooks.rejects(new Error('foo'));

                await assert.isRejected(run_(), /foo/);
            });
        });

        describe('afterEach hooks', () => {
            it('should be called if beforeEach hook failed', async () => {
                HookRunner.prototype.runBeforeEachHooks.rejects(new Error());

                await run_().catch(() => {});

                assert.calledOnce(HookRunner.prototype.runAfterEachHooks);
            });

            it('should be called even if test failed', async () => {
                const test = mkTest_({
                    fn: sinon.stub().rejects(new Error())
                });

                await run_({test}).catch(() => {});

                assert.calledOnce(HookRunner.prototype.runAfterEachHooks);
            });

            it('should fail on afterEach fail', async () => {
                HookRunner.prototype.runAfterEachHooks.rejects(new Error('foo'));

                await assert.isRejected(run_(), /foo/);
            });

            it('should reject with test error if both test and afterEach hooks failed', async () => {
                const test = mkTest_({
                    fn: sinon.stub().rejects(new Error('foo'))
                });
                HookRunner.prototype.runAfterEachHooks.rejects(new Error('bar'));

                await assert.isRejected(run_({test}), /foo/);
            });
        });

        describe('on success', () => {
            it('should resolve with hermioneCtx object passed to execution thread', async () => {
                ExecutionThread.create.callsFake(({hermioneCtx}) => {
                    ExecutionThread.prototype.run.callsFake(() => hermioneCtx.foo = 'bar');
                    return Object.create(ExecutionThread.prototype);
                });

                const result = await run_();

                assert.match(result.hermioneCtx, {foo: 'bar'});
            });

            it('should extend hermioneCtx with empty assert view results', async () => {
                const result = await run_();

                assert.match(result.hermioneCtx, {assertViewResults: []});
            });

            it('should convert assert view results to raw object', async () => {
                const assertViewResults = AssertViewResults.create([{foo: 'bar'}]);

                ExecutionThread.create.callsFake(({hermioneCtx}) => {
                    ExecutionThread.prototype.run.callsFake(() => {
                        hermioneCtx.assertViewResults = assertViewResults;
                    });

                    return Object.create(ExecutionThread.prototype);
                });

                const result = await run_();

                assert.match(result.hermioneCtx, {assertViewResults: [{foo: 'bar'}]});
            });

            it('should fail if assert view results have fails', async () => {
                const assertViewResults = AssertViewResults.create([new Error()]);

                ExecutionThread.create.callsFake(({hermioneCtx}) => {
                    ExecutionThread.prototype.run.callsFake(() => {
                        hermioneCtx.assertViewResults = assertViewResults;
                    });

                    return Object.create(ExecutionThread.prototype);
                });

                await assert.isRejected(run_(), AssertViewError);
            });

            it('should resolve with browser meta and changes', async () => {
                ExecutionThread.create.callsFake(({browser}) => {
                    ExecutionThread.prototype.run.callsFake(() => {
                        browser.meta.foo = 'bar';
                        browser.changes.baz = 'qux';
                    });
                    return Object.create(ExecutionThread.prototype);
                });

                const result = await run_();

                assert.match(result.meta, {foo: 'bar'});
                assert.match(result.changes, {baz: 'qux'});
            });
        });

        describe('on fail', () => {
            it('should extend error with hermioneCtx object passed to execution thread', async () => {
                ExecutionThread.create.callsFake(({hermioneCtx}) => {
                    ExecutionThread.prototype.run.callsFake(() => {
                        hermioneCtx.foo = 'bar';
                        return Promise.reject(new Error());
                    });
                    return Object.create(ExecutionThread.prototype);
                });

                const error = await run_().catch((e) => e);

                assert.match(error.hermioneCtx, {foo: 'bar'});
            });

            it('should extend hermioneCtx with empty assert view results', async () => {
                ExecutionThread.prototype.run.rejects(new Error());

                const error = await run_().catch((e) => e);

                assert.match(error.hermioneCtx, {assertViewResults: []});
            });

            it('should convert assert view results to raw object', async () => {
                const assertViewResults = AssertViewResults.create([{foo: 'bar'}]);

                ExecutionThread.create.callsFake(({hermioneCtx}) => {
                    ExecutionThread.prototype.run.callsFake(() => {
                        hermioneCtx.assertViewResults = assertViewResults;
                        return Promise.reject(new Error());
                    });

                    return Object.create(ExecutionThread.prototype);
                });

                const error = await run_().catch((e) => e);

                assert.match(error.hermioneCtx, {assertViewResults: [{foo: 'bar'}]});
            });

            it('should extend error with browser meta and changes', async () => {
                ExecutionThread.create.callsFake(({browser}) => {
                    ExecutionThread.prototype.run.callsFake(() => {
                        browser.meta.foo = 'bar';
                        browser.changes.baz = 'qux';

                        return Promise.reject(new Error());
                    });

                    return Object.create(ExecutionThread.prototype);
                });

                const error = await run_().catch((e) => e);

                assert.match(error.meta, {foo: 'bar'});
                assert.match(error.changes, {baz: 'qux'});
            });
        });
    });
});
