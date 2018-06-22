'use strict';

const BrowserRunner = require('lib/runner/browser-runner');
const BrowserPool = require('lib/browser-pool');
const TestRunnerFabric = require('lib/runner/test-runner');
const TestRunner = require('lib/runner/test-runner/insistant-test-runner');
const TestCollection = require('lib/test-collection');
const Test = require('lib/test');
const Workers = require('lib/runner/workers');
const SuiteMonitor = require('lib/runner/suite-monitor');
const Events = require('lib/constants/runner-events');
const {BrowserAgent} = require('gemini-core');
const Promise = require('bluebird');

const {makeConfigStub} = require('../../utils');

describe('runner/browser-runner', () => {
    const sandbox = sinon.sandbox.create();

    const mkRunner_ = (opts = {}) => {
        const browserId = opts.browserId || 'defaultBro';
        const config = opts.config || makeConfigStub();
        const browserPool = opts.browserPool || BrowserPool.create(config);
        return BrowserRunner.create(browserId, config, browserPool);
    };

    const run_ = (opts = {}) => {
        const runner = opts.runner || mkRunner_();
        const testCollection = opts.testCollection || TestCollection.create();
        const workers = opts.workers || sinon.createStubInstance(Workers);

        return runner.run(testCollection, workers);
    };

    const stubTestCollection_ = (tests = []) => {
        TestCollection.prototype.mapTests.callsFake((browserId, cb) => {
            return tests.map(cb);
        });
    };

    beforeEach(() => {
        sandbox.spy(TestRunnerFabric, 'create');
        sandbox.stub(TestRunner.prototype, 'run').resolves();
        sandbox.stub(TestRunner.prototype, 'cancel');

        sandbox.stub(TestCollection.prototype, 'mapTests').returns([]);

        sandbox.spy(SuiteMonitor, 'create');
        sandbox.stub(SuiteMonitor.prototype, 'testBegin');
        sandbox.stub(SuiteMonitor.prototype, 'testEnd');
        sandbox.stub(SuiteMonitor.prototype, 'testRetry');

        sandbox.stub(BrowserAgent, 'create').returns(Object.create(BrowserAgent.prototype));

        stubTestCollection_([Test.create({title: 'defaultTitle'})]);
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create suite monitor', () => {
            mkRunner_();

            assert.calledOnce(SuiteMonitor.create);
        });

        [
            'SUITE_BEGIN',
            'SUITE_END'
        ].forEach((event) => {
            it(`should passthrough ${event} from suite monitor`, () => {
                const onEvent = sinon.stub().named(`on${event}`);

                mkRunner_({browserId: 'bro'}).on(Events[event], onEvent);

                const suiteMonitor = SuiteMonitor.create.firstCall.returnValue;
                suiteMonitor.emit(Events[event], {foo: 'bar'});

                assert.calledOnceWith(onEvent, {foo: 'bar', browserId: 'bro'});
            });
        });
    });

    describe('run', () => {
        it('should process only tests for specified browser', async () => {
            const runner = mkRunner_({browserId: 'bro'});

            await run_({runner});

            assert.calledOnceWith(TestCollection.prototype.mapTests, 'bro');
        });

        it('should create browser agent for each test in collection', async () => {
            const test1 = Test.create({title: 'foo'});
            const test2 = Test.create({title: 'bar'});

            stubTestCollection_([test1, test2]);

            const pool = BrowserPool.create(makeConfigStub());
            const runner = mkRunner_({browserId: 'bro', browserPool: pool});

            await run_({runner});

            assert.calledTwice(BrowserAgent.create);
            assert.calledWith(BrowserAgent.create, 'bro', pool);
            assert.calledWith(BrowserAgent.create, 'bro', pool);
        });

        it('should create test runner for each test in collection', async () => {
            const test1 = Test.create({title: 'foo'});
            const test2 = Test.create({title: 'bar'});

            stubTestCollection_([test1, test2]);

            await run_();

            assert.calledTwice(TestRunnerFabric.create);
            assert.calledWith(TestRunnerFabric.create, test1);
            assert.calledWith(TestRunnerFabric.create, test2);
        });

        it('should pass config and browser agent to test runner', async () => {
            const config = makeConfigStub();
            const browserAgent = BrowserAgent.create();
            BrowserAgent.create.returns(browserAgent);

            const runner = mkRunner_({config});

            await run_({runner});

            assert.calledOnceWith(TestRunnerFabric.create, sinon.match.any, config, browserAgent);
        });

        it('should pass workers to test runner', async () => {
            const workers = sinon.createStubInstance(Workers);

            await run_({workers});

            assert.calledOnceWith(TestRunner.prototype.run, workers);
        });

        it('should wait for all test runners', async () => {
            stubTestCollection_([Test.create({title: 'foo'}), Test.create({title: 'bar'})]);
            const afterFirstTest = sinon.stub().named('afterFirstTest');
            const afterSecondTest = sinon.stub().named('afterSecondTest');
            const afterRun = sinon.stub().named('afterRun');

            TestRunner.prototype.run.onFirstCall().callsFake(() => Promise.delay(1).then(afterFirstTest));
            TestRunner.prototype.run.onSecondCall().callsFake(() => Promise.delay(10).then(afterSecondTest));

            await run_();
            afterRun();

            assert.callOrder(
                afterFirstTest,
                afterSecondTest,
                afterRun
            );
        });

        [
            'TEST_BEGIN',
            'TEST_END',
            'TEST_PASS',
            'TEST_FAIL',
            'TEST_PENDING',
            'RETRY'
        ].forEach((event) => {
            it(`should passthrough ${event} from test runner`, async () => {
                TestRunner.prototype.run.callsFake(function() {
                    this.emit(Events[event], {foo: 'bar'});
                    return Promise.resolve();
                });

                const onEvent = sinon.stub().named(`on${event}`);
                const runner = mkRunner_({browserId: 'bro'})
                    .on(Events[event], onEvent);

                await run_({runner});

                assert.calledOnceWith(onEvent, {foo: 'bar', browserId: 'bro'});
            });
        });

        it('should passthrough SUITE_BEGIN from suite monitor before TEST_BEGIN from test runner', async () => {
            const onTestBegin = sinon.stub().named('onTestBegin');
            const onSuiteBegin = sinon.stub().named('onSuiteBegin');

            SuiteMonitor.prototype.testBegin.callsFake(function() {
                this.emit(Events.SUITE_BEGIN);
            });
            TestRunner.prototype.run.callsFake(function() {
                this.emit(Events.TEST_BEGIN);
                return Promise.resolve();
            });

            const runner = mkRunner_()
                .on(Events.TEST_BEGIN, onTestBegin)
                .on(Events.SUITE_BEGIN, onSuiteBegin);

            await run_({runner});

            assert.callOrder(onSuiteBegin, onTestBegin);
        });

        it('should passthrough SUITE_END from suite monitor after TEST_END from test runner', async () => {
            const onTestEnd = sinon.stub().named('onTestEnd');
            const onSuiteEnd = sinon.stub().named('onSuiteEnd');

            SuiteMonitor.prototype.testEnd.callsFake(function() {
                this.emit(Events.SUITE_END);
            });
            TestRunner.prototype.run.callsFake(function() {
                this.emit(Events.TEST_END);
                return Promise.resolve();
            });

            const runner = mkRunner_()
                .on(Events.TEST_END, onTestEnd)
                .on(Events.SUITE_END, onSuiteEnd);

            await run_({runner});

            assert.callOrder(onTestEnd, onSuiteEnd);
        });

        it('should subscribe suite monitor to RETRY event', async () => {
            TestRunner.prototype.run.callsFake(function() {
                this.emit(Events.RETRY, {foo: 'bar'});
            });

            await run_();

            assert.calledOnceWith(SuiteMonitor.prototype.testRetry, sinon.match({foo: 'bar'}));
        });
    });

    describe('cancel', () => {
        it('should cancel all executing test runners', async () => {
            stubTestCollection_([Test.create(), Test.create()]);

            const runner = mkRunner_();
            TestRunner.prototype.run.onSecondCall().callsFake(() => {
                runner.cancel();
                return Promise.resolve();
            });

            await run_({runner});

            assert.calledTwice(TestRunner.prototype.cancel);
        });

        it('should not try to cancel finished test runner', async () => {
            const runner = mkRunner_();

            await run_({runner});

            runner.cancel();

            assert.notCalled(TestRunner.prototype.cancel);
        });
    });
});
