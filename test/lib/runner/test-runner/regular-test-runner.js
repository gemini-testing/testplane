'use strict';

const _ = require('lodash');

const {BrowserAgent} = require('gemini-core');
const RegularTestRunner = require('lib/runner/test-runner/regular-test-runner');
const Workers = require('lib/runner/workers');
const logger = require('lib/utils/logger');
const Events = require('lib/constants/runner-events');
const AssertViewResults = require('lib/browser/commands/assert-view/assert-view-results');
const Promise = require('bluebird');

const {makeConfigStub, makeTest} = require('../../../utils');

describe('runner/test-runner/regular-test-runner', () => {
    const sandbox = sinon.sandbox.create();

    const mkRunner_ = (opts = {}) => {
        const test = opts.test || makeTest({title: 'defaultTest'});
        const config = opts.config || makeConfigStub();
        const browserAgent = opts.browserAgent || BrowserAgent.create();

        return RegularTestRunner.create(test, config, browserAgent);
    };

    const run_ = (opts = {}) => {
        const runner = opts.runner || mkRunner_();
        const workers = opts.workers || Object.create(Workers.prototype);

        return runner.run(workers);
    };

    const stubBrowser_ = (opts = {}) => {
        return {
            id: opts.id || 'default-id',
            sessionId: opts.sessionId || 'default-session-id',
            updateChanges: sinon.stub()
        };
    };

    const stubTestResult_ = (opts = {}) => {
        return _.defaults(opts, {
            changes: {},
            meta: {},
            hermioneCtx: {}
        });
    };

    beforeEach(() => {
        sandbox.stub(BrowserAgent.prototype, 'getBrowser').resolves(stubBrowser_());
        sandbox.stub(BrowserAgent.prototype, 'freeBrowser').resolves();

        sandbox.stub(Workers.prototype, 'runTest').resolves(stubTestResult_());

        sandbox.stub(AssertViewResults, 'fromRawObject').returns(Object.create(AssertViewResults.prototype));
        sandbox.stub(AssertViewResults.prototype, 'get').returns({});

        sandbox.stub(logger, 'warn');
    });

    afterEach(() => sandbox.restore());

    describe('run', () => {
        it('should get browser before running test', async () => {
            BrowserAgent.prototype.getBrowser.resolves(stubBrowser_({
                id: 'bro',
                sessionId: '100500'
            }));

            await run_();

            assert.calledOnceWith(Workers.prototype.runTest, sinon.match.any, sinon.match({
                browserId: 'bro',
                sessionId: '100500'
            }));
        });

        it('should run test in workers', async () => {
            const test = makeTest({
                file: 'foo/bar',
                fullTitle: () => 'baz qux'
            });

            const runner = mkRunner_({test});

            await run_({runner});

            assert.calledOnceWith(Workers.prototype.runTest, 'baz qux', sinon.match({file: 'foo/bar'}));
        });

        describe('TEST_BEGIN event', () => {
            it('should be emitted on test begin with test data', async () => {
                const test = makeTest();
                const onTestBegin = sinon.stub().named('onTestBegin');
                const runner = mkRunner_({test})
                    .on(Events.TEST_BEGIN, onTestBegin);

                await run_({runner});

                assert.calledOnceWith(onTestBegin, sinon.match(test));
            });

            it('should be emitted with session id', async () => {
                const onTestBegin = sinon.stub().named('onTestBegin');
                const runner = mkRunner_()
                    .on(Events.TEST_BEGIN, onTestBegin);

                BrowserAgent.prototype.getBrowser.resolves(stubBrowser_({sessionId: '100500'}));

                await run_({runner});

                assert.calledOnceWith(onTestBegin, sinon.match({sessionId: '100500'}));
            });

            it('should be emitted even on browser get fail', async () => {
                const onTestBegin = sinon.stub().named('onTestBegin');
                const runner = mkRunner_()
                    .on(Events.TEST_BEGIN, onTestBegin);

                BrowserAgent.prototype.getBrowser.rejects();

                await run_({runner});

                assert.calledOnce(onTestBegin);
            });
        });

        describe('TEST_PASS event', () => {
            it('should be emitted on test pass wit test data', async () => {
                const test = makeTest();
                const onPass = sinon.stub().named('onPass');
                const runner = mkRunner_({test})
                    .on(Events.TEST_PASS, onPass);

                await run_({runner});

                assert.calledOnceWith(onPass, sinon.match(test));
            });

            it('should be emitted with session id', async () => {
                const onPass = sinon.stub().named('onPass');
                const runner = mkRunner_()
                    .on(Events.TEST_PASS, onPass);

                BrowserAgent.prototype.getBrowser.resolves(stubBrowser_({sessionId: '100500'}));

                await run_({runner});

                assert.calledOnceWith(onPass, sinon.match({sessionId: '100500'}));
            });

            it('should be emitted with test duration', async () => {
                sandbox.stub(Date, 'now')
                    .onFirstCall().returns(5)
                    .onSecondCall().returns(7);

                const onPass = sinon.stub().named('onPass');
                const runner = mkRunner_()
                    .on(Events.TEST_PASS, onPass);

                await run_({runner});

                assert.calledOnceWith(onPass, sinon.match({duration: 2}));
            });

            it('should be emitted with test meta and context', async () => {
                const onPass = sinon.stub().named('onPass');
                const runner = mkRunner_()
                    .on(Events.TEST_PASS, onPass);

                Workers.prototype.runTest.resolves(stubTestResult_({
                    meta: {foo: 'bar'},
                    hermioneCtx: {baz: 'qux'}
                }));

                await run_({runner});

                assert.calledOnceWith(onPass, sinon.match({
                    meta: {foo: 'bar'},
                    hermioneCtx: {baz: 'qux'}
                }));
            });

            it('should be emitted with assert view results', async () => {
                const onPass = sinon.stub().named('onPass');
                const runner = mkRunner_()
                    .on(Events.TEST_PASS, onPass);

                AssertViewResults.prototype.get.returns({foo: 'bar'});

                await run_({runner});

                assert.calledOnceWith(onPass, sinon.match({
                    assertViewResults: {foo: 'bar'}
                }));
            });

            it('assert view results in context should be converted to instance', async () => {
                const onPass = sinon.stub().named('onPass');
                const runner = mkRunner_()
                    .on(Events.TEST_PASS, onPass);

                Workers.prototype.runTest.resolves(stubTestResult_({
                    hermioneCtx: {
                        assertViewResults: ['foo', 'bar']
                    }
                }));

                const assertViewResults = Object.create(AssertViewResults.prototype);
                AssertViewResults.fromRawObject.withArgs(['foo', 'bar']).returns(assertViewResults);

                await run_({runner});

                const data = onPass.firstCall.args[0];
                assert.strictEqual(data.hermioneCtx.assertViewResults, assertViewResults);
            });
        });

        describe('TEST_FAIL event', () => {
            it('should be emitted on test fail with test data', async () => {
                const test = makeTest();
                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_({test})
                    .on(Events.TEST_FAIL, onFail);

                Workers.prototype.runTest.rejects(new Error());

                await run_({runner});

                assert.calledOnceWith(onFail, sinon.match(test));
            });

            it('should be emitted with error', async () => {
                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                const err = new Error();
                Workers.prototype.runTest.rejects(err);

                await run_({runner});

                assert.calledOnceWith(onFail, sinon.match({err}));
            });

            it('should be emitted with session id', async () => {
                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                Workers.prototype.runTest.rejects(new Error());

                BrowserAgent.prototype.getBrowser.resolves(stubBrowser_({sessionId: '100500'}));

                await run_({runner});

                assert.calledOnceWith(onFail, sinon.match({sessionId: '100500'}));
            });

            it('should be emitted with test duration', async () => {
                sandbox.stub(Date, 'now')
                    .onFirstCall().returns(5)
                    .onSecondCall().returns(7);

                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                Workers.prototype.runTest.rejects(new Error());

                await run_({runner});

                assert.calledOnceWith(onFail, sinon.match({duration: 2}));
            });

            it('should be emitted on get browser fail', async () => {
                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                const err = new Error();
                BrowserAgent.prototype.getBrowser.rejects(err);

                await run_({runner});

                assert.calledOnceWith(onFail, sinon.match({err}));
            });

            it('should be emitted with test meta and context', async () => {
                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                Workers.prototype.runTest.rejects({
                    meta: {foo: 'bar'},
                    hermioneCtx: {baz: 'qux'}
                });

                await run_({runner});

                assert.calledOnceWith(onFail, sinon.match({
                    meta: {foo: 'bar'},
                    hermioneCtx: {baz: 'qux'}
                }));
            });

            it('should be emitted with assert view results', async () => {
                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                Workers.prototype.runTest.rejects(new Error());
                AssertViewResults.prototype.get.returns({foo: 'bar'});

                await run_({runner});

                assert.calledOnceWith(onFail, sinon.match({
                    assertViewResults: {foo: 'bar'}
                }));
            });

            it('assert view results in context should be converted to instance', async () => {
                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                Workers.prototype.runTest.rejects({
                    hermioneCtx: {
                        assertViewResults: ['foo', 'bar']
                    }
                });

                const assertViewResults = Object.create(AssertViewResults.prototype);
                AssertViewResults.fromRawObject.withArgs(['foo', 'bar']).returns(assertViewResults);

                await run_({runner});

                const data = onFail.firstCall.args[0];
                assert.strictEqual(data.hermioneCtx.assertViewResults, assertViewResults);
            });
        });

        describe('TEST_END event', () => {
            it('should be emitted on test finish with test data', async () => {
                const test = makeTest();
                const onTestEnd = sinon.stub().named('onTestEnd');
                const runner = mkRunner_({test})
                    .on(Events.TEST_END, onTestEnd);

                await run_({runner});

                assert.calledOnceWith(onTestEnd, sinon.match(test));
            });

            it('should be emitted with session id', async () => {
                const onTestEnd = sinon.stub().named('onTestEnd');
                const runner = mkRunner_()
                    .on(Events.TEST_END, onTestEnd);

                BrowserAgent.prototype.getBrowser.resolves(stubBrowser_({sessionId: '100500'}));

                await run_({runner});

                assert.calledOnceWith(onTestEnd, sinon.match({sessionId: '100500'}));
            });

            it('should be emitted with test duration', async () => {
                sandbox.stub(Date, 'now')
                    .onFirstCall().returns(5)
                    .onSecondCall().returns(7);

                const onTestEnd = sinon.stub().named('onTestEnd');
                const runner = mkRunner_()
                    .on(Events.TEST_END, onTestEnd);

                await run_({runner});

                assert.calledOnceWith(onTestEnd, sinon.match({duration: 2}));
            });

            it('should be emitted on test fail', async () => {
                const onTestEnd = sinon.stub().named('onTestEnd');
                const runner = mkRunner_()
                    .on(Events.TEST_END, onTestEnd);

                Workers.prototype.runTest.rejects();

                await run_({runner});

                assert.calledOnce(onTestEnd);
            });
        });

        describe('browser changes', () => {
            it('should update browser changes after test finished', async () => {
                const browser = stubBrowser_();
                BrowserAgent.prototype.getBrowser.resolves(browser);

                Workers.prototype.runTest.resolves(stubTestResult_({
                    changes: {foo: 'bar'}
                }));

                await run_();

                assert.calledOnceWith(browser.updateChanges, {foo: 'bar'});
            });

            it('should update browser changes on test fail', async () => {
                const browser = stubBrowser_();
                BrowserAgent.prototype.getBrowser.resolves(browser);

                Workers.prototype.runTest.rejects({changes: {foo: 'bar'}});

                await run_();

                assert.calledOnceWith(browser.updateChanges, {foo: 'bar'});
            });
        });

        describe('freeBrowser', () => {
            it('should release browser after test finish', async () => {
                const browser = stubBrowser_({id: 'bro'});
                BrowserAgent.prototype.getBrowser.resolves(browser);

                await run_();

                assert.calledOnceWith(BrowserAgent.prototype.freeBrowser, browser);
            });

            it('should release browser even if test fails', async () => {
                Workers.prototype.runTest.rejects();

                await run_();

                assert.calledOnce(BrowserAgent.prototype.freeBrowser);
            });

            it('should force browser release if session is broken', async () => {
                const config = makeConfigStub({
                    system: {
                        patternsOnReject: ['FOO_BAR']
                    }
                });
                const runner = mkRunner_({config});
                Workers.prototype.runTest.rejects(new Error('FOO_BAR'));

                await run_({runner});

                assert.calledOnceWith(BrowserAgent.prototype.freeBrowser, sinon.match.any, {force: true});
            });

            it('should wait until browser is released', async () => {
                const afterBrowserFree = sinon.stub().named('afterBrowserFree');
                const afterRun = sinon.stub().named('afterRun');

                BrowserAgent.prototype.freeBrowser.callsFake(() => Promise.delay(10).then(afterBrowserFree));

                await run_();
                afterRun();

                assert.callOrder(afterBrowserFree, afterRun);
            });

            it('should not reject on browser release fail', async () => {
                BrowserAgent.prototype.freeBrowser.rejects();

                await assert.isFulfilled(run_());
            });

            it('should not fail test on browser release fail', async () => {
                const onTestFail = sinon.stub().named('onTestFail');

                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onTestFail);

                BrowserAgent.prototype.freeBrowser.rejects();

                await run_({runner});

                assert.notCalled(onTestFail);
            });
        });
    });
});
