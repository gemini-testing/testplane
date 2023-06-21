"use strict";

const RegularTestRunner = require("src/runner/test-runner/regular-test-runner");
const InsistantTestRunner = require("src/runner/test-runner/insistant-test-runner");
const HighPriorityBrowserAgent = require("src/runner/test-runner/high-priority-browser-agent");
const { MasterEvents: Events } = require("src/events");
const BrowserAgent = require("src/runner/browser-agent");
const { AssertViewError } = require("src/browser/commands/assert-view/errors/assert-view-error");
const { NoRefImageError } = require("src/browser/commands/assert-view/errors/no-ref-image-error");
const { Test } = require("src/test-reader/test-object");

const { makeConfigStub } = require("../../../utils");

describe("runner/test-runner/insistant-test-runner", () => {
    const sandbox = sinon.sandbox.create();

    const mkWorkers_ = () => {
        return {
            runTest: sandbox.stub().resolves(),
        };
    };

    const mkRunner_ = (opts = {}) => {
        const test = opts.test || new Test({ title: "default test" });
        const config = opts.config || makeConfigStub();

        const browserId = Object.keys(config.browsers)[0];
        const browserAgent = opts.browserAgent || BrowserAgent.create();
        browserAgent.browserId = browserId;

        return InsistantTestRunner.create(test, config, browserAgent);
    };

    const run_ = (opts = {}) => {
        const runner = opts.runner || mkRunner_();
        const workers = opts.workers || mkWorkers_();

        return runner.run(workers);
    };

    const onFirstTestRun_ = cb => {
        RegularTestRunner.prototype.run.onFirstCall().callsFake(function () {
            cb(this);
            return Promise.resolve();
        });
    };

    const onEachTestRun_ = cb => {
        RegularTestRunner.prototype.run.callsFake(function () {
            cb(this);
            return Promise.resolve();
        });
    };

    const makeFailedTest_ = () => {
        return Object.assign(new Test({}), { err: new Error() });
    };

    beforeEach(() => {
        sandbox.spy(RegularTestRunner, "create");
        sandbox.stub(RegularTestRunner.prototype, "run").resolves();

        sandbox.stub(HighPriorityBrowserAgent, "create").returns(HighPriorityBrowserAgent.prototype);
    });

    afterEach(() => sandbox.restore());

    describe("run", () => {
        it("should run test in regular test runner", async () => {
            const test = new Test({});
            const config = makeConfigStub();
            const browserAgent = BrowserAgent.create();

            const runner = InsistantTestRunner.create(test, config, browserAgent);
            const workers = mkWorkers_();

            await runner.run(workers);

            assert.calledOnceWith(RegularTestRunner.create, test, browserAgent);
            assert.calledOnceWith(RegularTestRunner.prototype.run, workers);
        });

        ["TEST_BEGIN", "TEST_PASS", "TEST_END"].forEach(event => {
            it(`should passthrough ${event} event`, async () => {
                const onEvent = sinon.spy().named(`on${event}`);

                const runner = mkRunner_().on(Events[event], onEvent);

                const test = new Test({});
                onEachTestRun_(innerRunner => innerRunner.emit(Events[event], test));

                await run_({ runner });

                assert.calledOnceWith(onEvent, test);
            });
        });

        describe("if no retries set", () => {
            describe("on test fail", () => {
                it("should run test only once", async () => {
                    onEachTestRun_(innerRunner => innerRunner.emit(Events.TEST_FAIL, makeFailedTest_()));

                    await run_();

                    assert.calledOnce(RegularTestRunner.prototype.run);
                });

                it("should not emit RETRY event", async () => {
                    const onRetry = sinon.spy().named("onRetry");
                    const runner = mkRunner_().on(Events.RETRY, onRetry);

                    onEachTestRun_(innerRunner => innerRunner.emit(Events.TEST_FAIL, makeFailedTest_()));

                    await run_({ runner });

                    assert.notCalled(onRetry);
                });

                it("should emit TEST_FAIL", async () => {
                    const onTestFail = sinon.spy().named("onTestFail");
                    const runner = mkRunner_().on(Events.TEST_FAIL, onTestFail);

                    const test = makeFailedTest_();
                    onEachTestRun_(innerRunner => innerRunner.emit(Events.TEST_FAIL, test));

                    await run_({ runner });

                    assert.calledOnceWith(onTestFail, test);
                });
            });
        });

        describe("if retries set", () => {
            const mkRunnerWithRetries_ = (opts = {}) => {
                return mkRunner_({
                    ...opts,
                    config: makeConfigStub({ retry: 1 }),
                });
            };

            it("should not retry successfull test", async () => {
                onFirstTestRun_(innerRunner => innerRunner.emit(Events.TEST_PASS));

                await run_({ runner: mkRunnerWithRetries_() });

                assert.calledOnce(RegularTestRunner.prototype.run);
            });

            describe("on test fail", () => {
                it("should retry failed test", async () => {
                    onFirstTestRun_(innerRunner => innerRunner.emit(Events.TEST_FAIL, makeFailedTest_()));

                    await run_({ runner: mkRunnerWithRetries_() });

                    assert.calledTwice(RegularTestRunner.prototype.run);
                });

                it("should create new test runner for each retry", async () => {
                    onFirstTestRun_(innerRunner => innerRunner.emit(Events.TEST_FAIL, makeFailedTest_()));

                    await run_({ runner: mkRunnerWithRetries_() });

                    assert.calledTwice(RegularTestRunner.create);
                });

                it("should create test runner with high priority browser agent", async () => {
                    onFirstTestRun_(innerRunner => innerRunner.emit(Events.TEST_FAIL, makeFailedTest_()));

                    const browserAgent = Object.create(BrowserAgent.prototype);
                    const highPriorityBrowserAgent = Object.create(HighPriorityBrowserAgent.prototype);
                    HighPriorityBrowserAgent.create.withArgs(browserAgent).returns(highPriorityBrowserAgent);
                    const runner = mkRunnerWithRetries_({ browserAgent });

                    await run_({ runner });

                    assert.calledWith(RegularTestRunner.create, sinon.match.any, highPriorityBrowserAgent);
                });

                it("should emit RETRY event", async () => {
                    const onRetry = sinon.spy().named("onRetry");
                    const runner = mkRunnerWithRetries_().on(Events.RETRY, onRetry);

                    const test = makeFailedTest_();
                    onFirstTestRun_(innerRunner => innerRunner.emit(Events.TEST_FAIL, test));

                    await run_({ runner });

                    assert.calledOnceWith(onRetry, test);
                });

                it("should pass retries left count with RETRY event", async () => {
                    const onRetry = sinon.spy().named("onRetry");
                    const config = makeConfigStub({ retry: 2 });
                    const runner = mkRunner_({ config }).on(Events.RETRY, onRetry);

                    onEachTestRun_(innerRunner => innerRunner.emit(Events.TEST_FAIL, makeFailedTest_()));

                    await run_({ runner });

                    assert.calledWith(onRetry, sinon.match({ retriesLeft: 2 }));
                    assert.calledWith(onRetry, sinon.match({ retriesLeft: 1 }));
                    assert.neverCalledWith(onRetry, sinon.match({ retriesLeft: 0 }));
                });

                it("should not emit TEST_FAIL on retry", async () => {
                    const onTestFail = sinon.spy().named("onTestFail");
                    const runner = mkRunnerWithRetries_().on(Events.TEST_FAIL, onTestFail);

                    onFirstTestRun_(innerRunner => innerRunner.emit(Events.TEST_FAIL, makeFailedTest_()));

                    await run_({ runner });

                    assert.notCalled(onTestFail);
                });

                it("should emit TEST_FAIL if test finally failed", async () => {
                    const onTestFail = sinon.spy().named("onTestFail");
                    const runner = mkRunnerWithRetries_().on(Events.TEST_FAIL, onTestFail);

                    const test = makeFailedTest_();
                    onEachTestRun_(innerRunner => innerRunner.emit(Events.TEST_FAIL, test));

                    await run_({ runner });

                    assert.calledOnceWith(onTestFail, test);
                });

                it("should not retry assert view fail with NoRefImageError", async () => {
                    onEachTestRun_(innerRunner => {
                        const test = new Test({});
                        test.err = new AssertViewError();
                        test.assertViewResults = [new NoRefImageError("some-state", {}, {})];

                        innerRunner.emit(Events.TEST_FAIL, test);
                    });

                    await run_({ runner: mkRunnerWithRetries_() });

                    assert.calledOnce(RegularTestRunner.prototype.run);
                });

                it("should retry regular fail with NoRefImageError in assert view results", async () => {
                    onFirstTestRun_(innerRunner => {
                        const test = new Test({});
                        test.err = new Error();
                        test.assertViewResults = [new NoRefImageError("some-state", {}, {})];

                        innerRunner.emit(Events.TEST_FAIL, test);
                    });

                    await run_({ runner: mkRunnerWithRetries_() });

                    assert.calledTwice(RegularTestRunner.prototype.run);
                });

                describe("if retries dropped at runtime", () => {
                    let runner;

                    beforeEach(() => {
                        const config = makeConfigStub({ browsers: ["bro"], retry: 1 });
                        runner = mkRunner_({ config });

                        onFirstTestRun_(innerRunner => {
                            config.forBrowser("bro").retry = 0;
                            innerRunner.emit(Events.TEST_FAIL, makeFailedTest_());
                        });
                    });

                    it("should not retry", async () => {
                        await run_({ runner });

                        assert.calledOnce(RegularTestRunner.prototype.run);
                    });

                    it("should not emit RETRY event", async () => {
                        const onRetry = sinon.spy().named("onRetry");
                        runner.on(Events.RETRY, onRetry);

                        await run_({ runner });

                        assert.notCalled(onRetry);
                    });

                    it("should emit TEST_FAIL event", async () => {
                        const onTestFail = sinon.spy().named("onTestFail");
                        runner.on(Events.TEST_FAIL, onTestFail);

                        await run_({ runner });

                        assert.calledOnce(onTestFail);
                    });
                });

                describe("if cancel called at runtime", () => {
                    it("shold not retry test", async () => {
                        const runner = mkRunnerWithRetries_();

                        onFirstTestRun_(innerRunner => {
                            runner.cancel();
                            innerRunner.emit(Events.TEST_FAIL, makeFailedTest_());
                        });

                        await run_({ runner });

                        assert.calledOnce(RegularTestRunner.prototype.run);
                    });
                });
            });
        });

        describe("when shouldRetry set in config", async () => {
            it("should retry if no retries left but shouldRetry returns true", async () => {
                const config = makeConfigStub({
                    retry: 0,
                    shouldRetry: () => true,
                });

                const runner = mkRunner_({ config });

                RegularTestRunner.prototype.run.onFirstCall().callsFake(function () {
                    this.emit(Events.TEST_FAIL);
                    return Promise.resolve();
                });

                await run_({ runner });

                assert.calledTwice(RegularTestRunner.prototype.run);
            });

            it("should not retry if there are some retries left but shouldRetry returns false", async () => {
                const config = makeConfigStub({
                    retry: 1,
                    shouldRetry: () => false,
                });

                const runner = mkRunner_({ config });

                RegularTestRunner.prototype.run.callsFake(function () {
                    this.emit(Events.TEST_FAIL);
                    return Promise.resolve();
                });

                await run_({ runner });

                assert.calledOnce(RegularTestRunner.prototype.run);
            });

            it("should pass appropriate args to shouldRetry", async () => {
                const shouldRetry = sinon.spy().named("shouldRetry");

                const config = makeConfigStub({
                    retry: 100500,
                    shouldRetry,
                });

                const runner = mkRunner_({ config });

                const test = makeFailedTest_();
                RegularTestRunner.prototype.run.callsFake(function () {
                    this.emit(Events.TEST_FAIL, test);
                    return Promise.resolve();
                });

                await run_({ runner });

                assert.calledOnceWith(shouldRetry, {
                    ctx: test,
                    retriesLeft: 100500,
                });
            });
        });
    });
});
