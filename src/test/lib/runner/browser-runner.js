'use strict';

const Promise = require('bluebird');
const BrowserRunner = require('lib/runner/browser-runner');
const BrowserAgent = require('lib/runner/browser-agent');
const BrowserPool = require('lib/browser-pool');
const TestRunnerFabric = require('lib/runner/test-runner');
const TestRunner = require('lib/runner/test-runner/insistant-test-runner');
const TestCollection = require('lib/test-collection');
const {Test} = require('lib/test-reader/test-object');
const SuiteMonitor = require('lib/runner/suite-monitor');
const Events = require('lib/constants/runner-events');

const {makeConfigStub} = require('../../utils');

describe('runner/browser-runner', () => {
    const sandbox = sinon.sandbox.create();

    const mkWorkers_ = () => {
        return {
            runTest: sandbox.stub().resolves()
        };
    };

    const mkRunner_ = (opts = {}) => {
        const browserId = opts.browserId || 'defaultBro';
        const config = opts.config || makeConfigStub();
        const browserPool = opts.browserPool || BrowserPool.create(config);
        const workers = opts.workers || mkWorkers_();

        return BrowserRunner.create(browserId, config, browserPool, workers);
    };

    const run_ = (opts = {}) => {
        const runner = opts.runner || mkRunner_();
        const config = makeConfigStub();
        const specs = {'defaultBro': []};
        const testCollection = opts.testCollection || TestCollection.create(specs, config);

        return runner.run(testCollection);
    };

    const stubTestCollection_ = (tests = [], browserVersion = '1.0') => {
        TestCollection.prototype.eachTestByVersions.callsFake((browserId, cb) => tests.forEach((test) => {
            test.browserVersion = browserVersion;

            cb(test, browserId, browserVersion);
        }));
    };

    beforeEach(() => {
        sandbox.spy(TestRunnerFabric, 'create');
        sandbox.stub(TestRunner.prototype, 'run').resolves();
        sandbox.stub(TestRunner.prototype, 'cancel');

        sandbox.stub(TestCollection.prototype, 'eachTestByVersions');

        sandbox.spy(SuiteMonitor, 'create');
        sandbox.stub(SuiteMonitor.prototype, 'testBegin');
        sandbox.stub(SuiteMonitor.prototype, 'testEnd');
        sandbox.stub(SuiteMonitor.prototype, 'testRetry');

        const browserAgent = Object.create(BrowserAgent.prototype);
        browserAgent.browserId = 'default-bro-id';
        sandbox.stub(BrowserAgent, 'create').returns(browserAgent);

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

    describe('addTestToRun', async () => {
        it('should add test to the list of the tests to execute', async () => {
            const test1 = Test.create({title: 'foo'});
            const test2 = Test.create({title: 'bar'});
            const afterRun = sinon.stub().named('afterRun');
            stubTestCollection_([test1]);
            const runner = mkRunner_({browserId: 'bro'});

            const runPromise = run_({runner}).then(afterRun);
            runner.addTestToRun(test2);
            await runPromise;

            assert.callOrder(
                TestRunnerFabric.create.withArgs(test1).named('test1'),
                TestRunnerFabric.create.withArgs(test2).named('test2'),
                afterRun
            );
        });

        it('should run added test', async () => {
            const runner = mkRunner_({browserId: 'bro'});
            const test1 = Test.create({title: 'foo'});
            const test2 = Test.create({title: 'bar'});
            const addedTestRunner = sandbox.stub();
            stubTestCollection_([test1]);
            TestRunner.prototype.run.onFirstCall().callsFake(() => runner.addTestToRun(test2));
            TestRunner.prototype.run.onSecondCall().callsFake(addedTestRunner);

            await run_({runner});

            assert.calledTwice(TestRunner.prototype.run);
            assert.calledOnce(addedTestRunner);
        });
    });

    describe('run', () => {
        it('should process only tests for specified browser', async () => {
            const runner = mkRunner_({browserId: 'bro'});

            await run_({runner});

            assert.calledOnceWith(TestCollection.prototype.eachTestByVersions, 'bro');
        });

        it('should create browser agent for each test in collection', async () => {
            const test1 = Test.create({title: 'foo'});
            const test2 = Test.create({title: 'bar'});

            stubTestCollection_([test1, test2], '1.0');

            const pool = BrowserPool.create(makeConfigStub());
            const runner = mkRunner_({browserId: 'bro', browserPool: pool});

            await run_({runner});

            assert.calledTwice(BrowserAgent.create);
            assert.calledWith(BrowserAgent.create.firstCall, 'bro', '1.0', pool);
            assert.calledWith(BrowserAgent.create.secondCall, 'bro', '1.0', pool);
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
            stubTestCollection_([Test.create({}), Test.create({})]);

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
