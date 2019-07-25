'use strict';

const _ = require('lodash');

const {BrowserAgent} = require('gemini-core');
const RegularTestRunner = require('lib/runner/test-runner/regular-test-runner');
const WorkersRegistry = require('lib/utils/workers-registry');
const logger = require('lib/utils/logger');
const Events = require('lib/constants/runner-events');
const AssertViewResults = require('lib/browser/commands/assert-view/assert-view-results');
const Promise = require('bluebird');
const {EventEmitter} = require('events');

const {makeTest} = require('../../../utils');

describe('runner/test-runner/regular-test-runner', () => {
    const sandbox = sinon.sandbox.create();

    const stubTestResult_ = (opts = {}) => {
        return _.defaults(opts, {
            browserState: {},
            meta: {},
            hermioneCtx: {}
        });
    };

    const mkWorkers_ = () => {
        return _.extend(new EventEmitter(), {
            runTest: sandbox.stub().resolves(stubTestResult_())
        });
    };

    const mkRunner_ = (opts = {}) => {
        const test = opts.test || makeTest({title: 'defaultTest'});
        const browserAgent = opts.browserAgent || BrowserAgent.create();

        return RegularTestRunner.create(test, browserAgent);
    };

    const run_ = (opts = {}) => {
        const runner = opts.runner || mkRunner_();
        const workers = opts.workers || mkWorkers_();

        return runner.run(workers);
    };

    const stubBrowser_ = (opts = {}) => {
        return {
            id: opts.id || 'default-id',
            state: opts.state || {isBroken: false},
            sessionId: opts.sessionId || 'default-session-id',
            applyState: sinon.stub().callsFake(function(state) {
                this.state = state;
            })
        };
    };

    beforeEach(() => {
        sandbox.stub(BrowserAgent.prototype, 'getBrowser').resolves(stubBrowser_());
        sandbox.stub(BrowserAgent.prototype, 'freeBrowser').resolves();

        sandbox.stub(WorkersRegistry.prototype, 'register').returns(mkWorkers_());

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
            const workers = mkWorkers_();

            await run_({workers});

            assert.calledOnceWith(workers.runTest, sinon.match.any, sinon.match({
                browserId: 'bro',
                sessionId: '100500'
            }));
        });

        it('should run test in workers', async () => {
            const test = makeTest({
                file: 'foo/bar',
                fullTitle: () => 'baz qux'
            });

            const workers = mkWorkers_();
            const runner = mkRunner_({test});

            await run_({runner, workers});

            assert.calledOnceWith(workers.runTest, 'baz qux', sinon.match({file: 'foo/bar'}));
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

                const workers = mkWorkers_();
                workers.runTest.resolves(stubTestResult_({
                    meta: {foo: 'bar'},
                    hermioneCtx: {baz: 'qux'}
                }));

                await run_({runner, workers});

                assert.calledOnceWith(onPass, sinon.match({
                    meta: {foo: 'bar'},
                    hermioneCtx: {baz: 'qux'}
                }));
            });

            it('should extend test meta from master process by test meta from worker', async () => {
                const onPass = sinon.stub().named('onPass');
                const runner = mkRunner_({test: makeTest({meta: {foo: 'bar'}})})
                    .on(Events.TEST_PASS, onPass);

                const workers = mkWorkers_();
                workers.runTest.resolves(stubTestResult_({meta: {baz: 'qux'}}));

                await run_({runner, workers});

                assert.calledOnceWith(onPass, sinon.match({
                    meta: {foo: 'bar', baz: 'qux'}
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

                const workers = mkWorkers_();
                workers.runTest.resolves(stubTestResult_({
                    hermioneCtx: {
                        assertViewResults: ['foo', 'bar']
                    }
                }));

                const assertViewResults = Object.create(AssertViewResults.prototype);
                AssertViewResults.fromRawObject.withArgs(['foo', 'bar']).returns(assertViewResults);

                await run_({runner, workers});

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

                const workers = mkWorkers_();
                workers.runTest.rejects(new Error());

                await run_({runner, workers});

                assert.calledOnceWith(onFail, sinon.match(test));
            });

            it('should be emitted with error', async () => {
                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                const err = new Error();
                const workers = mkWorkers_();
                workers.runTest.rejects(err);

                await run_({runner, workers});

                assert.calledOnceWith(onFail, sinon.match({err}));
            });

            it('should be emitted with session id', async () => {
                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                const workers = mkWorkers_();
                workers.runTest.rejects(new Error());

                BrowserAgent.prototype.getBrowser.resolves(stubBrowser_({sessionId: '100500'}));

                await run_({runner, workers});

                assert.calledOnceWith(onFail, sinon.match({sessionId: '100500'}));
            });

            it('should be emitted with test duration', async () => {
                sandbox.stub(Date, 'now')
                    .onFirstCall().returns(5)
                    .onSecondCall().returns(7);

                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                const workers = mkWorkers_();
                workers.runTest.rejects(new Error());

                await run_({runner, workers});

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

                const workers = mkWorkers_();
                workers.runTest.rejects({
                    meta: {foo: 'bar'},
                    hermioneCtx: {baz: 'qux'}
                });

                await run_({runner, workers});

                assert.calledOnceWith(onFail, sinon.match({
                    meta: {foo: 'bar'},
                    hermioneCtx: {baz: 'qux'}
                }));
            });

            it('should be emitted with assert view results', async () => {
                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                const workers = mkWorkers_();
                workers.runTest.rejects(new Error());
                AssertViewResults.prototype.get.returns({foo: 'bar'});

                await run_({runner, workers});

                assert.calledOnceWith(onFail, sinon.match({
                    assertViewResults: {foo: 'bar'}
                }));
            });

            it('assert view results in context should be converted to instance', async () => {
                const onFail = sinon.stub().named('onFail');
                const runner = mkRunner_()
                    .on(Events.TEST_FAIL, onFail);

                const workers = mkWorkers_();
                workers.runTest.rejects({
                    hermioneCtx: {
                        assertViewResults: ['foo', 'bar']
                    }
                });

                const assertViewResults = Object.create(AssertViewResults.prototype);
                AssertViewResults.fromRawObject.withArgs(['foo', 'bar']).returns(assertViewResults);

                await run_({runner, workers});

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

                const workers = mkWorkers_();
                workers.runTest.rejects();

                await run_({runner, workers});

                assert.calledOnce(onTestEnd);
            });
        });

        describe('freeBrowser', () => {
            const runTest_ = async ({onRun, onTestFail}) => {
                const test = makeTest({id: 'foo', browserId: 'bar'});
                const runner = mkRunner_({test});

                if (onTestFail) {
                    runner.on(Events.TEST_FAIL, onTestFail);
                }

                const workers = mkWorkers_();
                workers.runTest.callsFake(() => {
                    onRun({workers, test});
                    return stubTestResult_();
                });

                await run_({runner, workers});
            };

            it('should release browser on related event from worker', async () => {
                const browser = stubBrowser_();
                BrowserAgent.prototype.getBrowser.resolves(browser);

                await runTest_({onRun: ({workers, test}) => {
                    workers.emit(`worker.${test.id}.${test.browserId}.freeBrowser`);
                }});

                assert.calledOnceWith(BrowserAgent.prototype.freeBrowser, browser);
            });

            it('should release browser only once', async () => {
                await runTest_({onRun: ({workers, test}) => {
                    workers.emit(`worker.${test.id}.${test.browserId}.freeBrowser`);
                    workers.emit(`worker.${test.id}.${test.browserId}.freeBrowser`);
                }});

                assert.calledOnce(BrowserAgent.prototype.freeBrowser);
            });

            it('should apply browser state passed with free event before releasing browser', async () => {
                const browser = stubBrowser_();
                BrowserAgent.prototype.getBrowser.resolves(browser);

                await runTest_({onRun: ({workers, test}) => {
                    workers.emit(`worker.${test.id}.${test.browserId}.freeBrowser`, {foo: 'bar'});
                    return stubTestResult_();
                }});

                assert.calledOnceWith(browser.applyState, {foo: 'bar'});
                assert.callOrder(browser.applyState, BrowserAgent.prototype.freeBrowser);
            });

            it('should wait until browser is released', async () => {
                const afterBrowserFree = sinon.stub().named('afterBrowserFree');
                const afterRun = sinon.stub().named('afterRun');

                BrowserAgent.prototype.freeBrowser.callsFake(() => Promise.delay(10).then(afterBrowserFree));

                await runTest_({onRun: ({workers, test}) => {
                    workers.emit(`worker.${test.id}.${test.browserId}.freeBrowser`);
                }});

                afterRun();

                assert.callOrder(afterBrowserFree, afterRun);
            });

            it('should not reject on browser release fail', async () => {
                BrowserAgent.prototype.freeBrowser.rejects();

                const res = runTest_({onRun: ({workers, test}) => {
                    workers.emit(`worker.${test.id}.${test.browserId}.freeBrowser`);
                }});

                await assert.isFulfilled(res);
            });

            it('should not fail test on browser release fail', async () => {
                const onTestFail = sinon.stub().named('onTestFail');
                BrowserAgent.prototype.freeBrowser.rejects();

                await runTest_({
                    onRun: ({workers, test}) => {
                        workers.emit(`worker.${test.id}.${test.browserId}.freeBrowser`);
                    },
                    onTestFail
                }).catch((e) => e);

                assert.notCalled(onTestFail);
            });
        });
    });
});
