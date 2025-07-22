"use strict";

const proxyquire = require("proxyquire");
const BrowserAgent = require("src/runner/browser-agent");
const BrowserPool = require("src/browser-pool");
const { create } = require("src/runner/test-runner");
const TestRunner = require("src/runner/test-runner/insistant-test-runner");
const { TestCollection } = require("src/test-collection");
const { Test } = require("src/test-reader/test-object");
const SuiteMonitor = require("src/runner/suite-monitor");
const { MasterEvents: Events } = require("src/events");

const { makeConfigStub } = require("../../utils");
const { promiseDelay } = require("../../../src/utils/promise");

describe("runner/browser-runner", () => {
    const sandbox = sinon.createSandbox();
    let BrowserRunner;
    let TestRunnerFabric = { create };

    const mkWorkers_ = () => {
        return {
            runTest: sandbox.stub().resolves(),
        };
    };

    const mkRunner_ = (opts = {}) => {
        const browserId = opts.browserId || "defaultBro";
        const config = opts.config || makeConfigStub();
        const browserPool = opts.browserPool || BrowserPool.create(config);
        const workers = opts.workers || mkWorkers_();

        return BrowserRunner.create(browserId, config, browserPool, workers);
    };

    const run_ = (opts = {}) => {
        const runner = opts.runner || mkRunner_();
        const config = makeConfigStub();
        const specs = { defaultBro: [] };
        const testCollection = opts.testCollection || TestCollection.create(specs, config);

        testCollection.eachTest(test => runner.addTestToRun(test));

        return runner.waitTestsCompletion();
    };

    const stubTestCollection_ = (tests = [], browserVersion = "1.0") => {
        TestCollection.prototype.eachTest.callsFake(cb =>
            tests.forEach(test => {
                test.browserVersion = browserVersion;

                cb(test);
            }),
        );
    };

    beforeEach(() => {
        sandbox.spy(TestRunnerFabric, "create");
        sandbox.stub(TestRunner.prototype, "run").resolves();
        sandbox.stub(TestRunner.prototype, "cancel");

        sandbox.stub(TestCollection.prototype, "eachTest");

        sandbox.spy(SuiteMonitor, "create");
        sandbox.stub(SuiteMonitor.prototype, "testBegin");
        sandbox.stub(SuiteMonitor.prototype, "testEnd");
        sandbox.stub(SuiteMonitor.prototype, "testRetry");

        const browserAgent = Object.create(BrowserAgent.prototype);
        browserAgent.browserId = "default-bro-id";
        sandbox.stub(BrowserAgent, "create").returns(browserAgent);

        stubTestCollection_([Test.create({ title: "defaultTitle" })]);

        BrowserRunner = proxyquire("src/runner/browser-runner", {
            "./test-runner": TestRunnerFabric,
        }).BrowserRunner;
    });

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        it("should create suite monitor", () => {
            mkRunner_();

            assert.calledOnce(SuiteMonitor.create);
        });

        ["SUITE_BEGIN", "SUITE_END"].forEach(event => {
            it(`should passthrough ${event} from suite monitor`, () => {
                const onEvent = sinon.stub().named(`on${event}`);

                mkRunner_({ browserId: "bro" }).on(Events[event], onEvent);

                const suiteMonitor = SuiteMonitor.create.firstCall.returnValue;
                suiteMonitor.emit(Events[event], { foo: "bar" });

                assert.calledOnceWith(onEvent, { foo: "bar", browserId: "bro" });
            });
        });
    });

    describe("addTestToRun", async () => {
        it("should add test to the list of the tests to execute", async () => {
            const test1 = Test.create({ title: "foo" });
            const test2 = Test.create({ title: "bar" });
            const afterRun = sinon.stub().named("afterRun");
            stubTestCollection_([test1]);
            const runner = mkRunner_({ browserId: "bro" });

            const runPromise = run_({ runner }).then(afterRun);
            runner.addTestToRun(test2);
            await runPromise;

            assert.callOrder(
                TestRunnerFabric.create.withArgs(test1).named("test1"),
                TestRunnerFabric.create.withArgs(test2).named("test2"),
                afterRun,
            );
        });

        it("should run added test", async () => {
            const runner = mkRunner_({ browserId: "bro" });
            const test1 = Test.create({ title: "foo" });
            const test2 = Test.create({ title: "bar" });
            const addedTestRunner = sandbox.stub();
            stubTestCollection_([test1]);
            TestRunner.prototype.run.onFirstCall().callsFake(() => runner.addTestToRun(test2));
            TestRunner.prototype.run.onSecondCall().callsFake(addedTestRunner);

            await run_({ runner });

            assert.calledTwice(TestRunner.prototype.run);
            assert.calledOnce(addedTestRunner);
        });
    });

    describe("waitTestsCompletion", () => {
        it("should wait for all tests to complete", async () => {
            const runner = mkRunner_({ browserId: "bro" });
            const afterFirstTest = sinon.stub().named("afterFirstTest");
            const afterSecondTest = sinon.stub().named("afterSecondTest");
            const afterWait = sinon.stub().named("afterWait");

            TestRunner.prototype.run.onFirstCall().callsFake(() => promiseDelay(1).then(afterFirstTest));
            TestRunner.prototype.run.onSecondCall().callsFake(() => promiseDelay(10).then(afterSecondTest));

            runner.addTestToRun(Test.create({ title: "foo" }));
            runner.addTestToRun(Test.create({ title: "bar" }));
            await runner.waitTestsCompletion().then(afterWait);

            assert.callOrder(afterFirstTest, afterSecondTest, afterWait);
        });
    });

    describe("cancel", () => {
        it("should cancel all executing test runners", async () => {
            stubTestCollection_([Test.create({}), Test.create({})]);

            const runner = mkRunner_();
            TestRunner.prototype.run.onSecondCall().callsFake(() => {
                runner.cancel();
                return Promise.resolve();
            });

            await run_({ runner });

            assert.calledTwice(TestRunner.prototype.cancel);
        });

        it("should not try to cancel finished test runner", async () => {
            const runner = mkRunner_();

            await run_({ runner });

            runner.cancel();

            assert.notCalled(TestRunner.prototype.cancel);
        });
    });
});
