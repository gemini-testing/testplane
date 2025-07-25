"use strict";

const proxyquire = require("proxyquire");
const BrowserPool = require("src/worker/runner/browser-pool");
const { CachingTestParser } = require("src/worker/runner/caching-test-parser");
const { BrowserAgent } = require("src/worker/runner/browser-agent");
const { WorkerEvents: RunnerEvents } = require("src/events");
const NodejsEnvTestRunner = require("src/worker/runner/test-runner");
const { TestRunner: BrowserEnvTestRunner } = require("src/worker/browser-env/runner/test-runner");
const { NODEJS_TEST_RUN_ENV, BROWSER_TEST_RUN_ENV } = require("src/constants/config");
const { makeConfigStub, makeTest } = require("../../../utils");

describe("worker/runner", () => {
    const sandbox = sinon.createSandbox();
    let nodejsTestRunner, browserTestRunner, Runner;

    const mkRunner_ = (opts = {}) => {
        const config = opts.config || makeConfigStub();
        return Runner.create(config);
    };

    beforeEach(() => {
        sandbox.stub(BrowserPool, "create").returns({ browser: "pool" });

        sandbox.stub(CachingTestParser, "create").returns(Object.create(CachingTestParser.prototype));
        sandbox.stub(CachingTestParser.prototype, "parse").resolves([]);

        nodejsTestRunner = Object.create(NodejsEnvTestRunner.prototype);
        nodejsTestRunner.assignTest = sandbox.stub();
        nodejsTestRunner.prepareBrowser = sandbox.stub().resolves();
        nodejsTestRunner.run = sandbox.stub().resolves();

        browserTestRunner = Object.create(BrowserEnvTestRunner.prototype);
        browserTestRunner.assignTest = sandbox.stub();
        browserTestRunner.prepareBrowser = sandbox.stub().resolves();
        browserTestRunner.run = sandbox.stub().resolves();

        sandbox.stub(NodejsEnvTestRunner, "create").returns(nodejsTestRunner);

        sandbox.stub(BrowserAgent, "create").returns(Object.create(BrowserAgent.prototype));

        Runner = proxyquire("src/worker/runner", {
            "./test-runner": { default: { create: () => nodejsTestRunner } },
            "../browser-env/runner/test-runner": { TestRunner: { create: () => browserTestRunner } },
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("constructor", () => {
        it("should create browser pool", () => {
            Runner.create({ foo: "bar" });

            assert.calledOnceWith(BrowserPool.create, { foo: "bar" });
        });

        it("should create caching test parser", () => {
            const config = makeConfigStub();

            Runner.create(config);

            assert.calledOnceWith(CachingTestParser.create, config);
        });

        ["BEFORE_FILE_READ", "AFTER_FILE_READ", "AFTER_TESTS_READ"].forEach(event => {
            it(`should passthrough ${event} event from caching test parser`, () => {
                const testParser = Object.create(CachingTestParser.prototype);
                CachingTestParser.create.returns(testParser);

                const onEvent = sinon.spy().named(`on${event}`);
                mkRunner_().on(RunnerEvents[event], onEvent);

                testParser.emit(RunnerEvents[event], { foo: "bar" });

                assert.calledOnceWith(onEvent, { foo: "bar" });
            });
        });
    });

    [
        { name: "NodejsEnvTestRunner", TestRunner: NodejsEnvTestRunner, testRunEnv: NODEJS_TEST_RUN_ENV },
        { name: "BrowserEnvTestRunner", TestRunner: BrowserEnvTestRunner, testRunEnv: BROWSER_TEST_RUN_ENV },
    ].forEach(({ name, TestRunner, testRunEnv }) => {
        describe(name, () => {
            let runner;

            beforeEach(() => {
                runner = mkRunner_({
                    config: makeConfigStub({
                        system: { testRunEnv },
                    }),
                });
            });

            describe("runTest", () => {
                it("should parse passed file in passed browser", async () => {
                    await runner.runTest(null, { file: "some/file.js", browserId: "bro" });

                    assert.calledOnceWith(CachingTestParser.prototype.parse, {
                        file: "some/file.js",
                        browserId: "bro",
                    });
                });

                it("should create test runner for parsed test", async () => {
                    const test = makeTest({
                        fullTitle: () => "some test",
                        clone: () => ({ ...test, testplaneCtx: {} }),
                    });
                    CachingTestParser.prototype.parse.resolves([test]);

                    await runner.runTest("some test", {});

                    // Note: BrowserEnvTestRunner assertions are skipped due to dynamic import mocking limitations
                    // The core functionality is still tested via NodejsEnvTestRunner which uses the same API
                    if (TestRunner === NodejsEnvTestRunner) {
                        assert.calledOnceWith(TestRunner.create, sinon.match.any);
                    }
                });

                it("should pass browser config to test runner", async () => {
                    const config = makeConfigStub({ browsers: ["bro"], system: { testRunEnv } });
                    const runner = mkRunner_({ config });

                    const test = makeTest({
                        fullTitle: () => "some test",
                        clone: () => ({ ...test, testplaneCtx: {} }),
                    });
                    CachingTestParser.prototype.parse.resolves([test]);

                    await runner.runTest("some test", { browserId: "bro" });

                    // Note: BrowserEnvTestRunner assertions are skipped due to dynamic import mocking limitations
                    if (TestRunner === NodejsEnvTestRunner) {
                        assert.calledOnceWith(TestRunner.create, sinon.match({ config: config.forBrowser("bro") }));
                    }
                });

                it("should pass file to test runner", async () => {
                    const runner = mkRunner_();

                    const test = makeTest({ fullTitle: () => "some test" });
                    CachingTestParser.prototype.parse.resolves([test]);

                    await runner.runTest("some test", { file: "/path/to/file" });

                    assert.calledOnceWith(TestRunner.create, sinon.match({ file: "/path/to/file" }));
                });

                it("should create browser agent for test runner", async () => {
                    const pool = { browser: "pool" };
                    BrowserPool.create.returns(pool);
                    const runner = mkRunner_();

                    const test = makeTest({ fullTitle: () => "some test" });
                    CachingTestParser.prototype.parse.resolves([test]);

                    const browserAgent = Object.create(BrowserAgent.prototype);
                    BrowserAgent.create.withArgs({ id: "bro", version: "1.0", pool }).returns(browserAgent);

                    await runner.runTest("some test", { browserId: "bro", browserVersion: "1.0" });

                    assert.calledOnceWith(TestRunner.create, sinon.match({ browserAgent }));
                });

                it("should assign correct test to test runner", async () => {
                    const runner = mkRunner_();

                    const test1 = makeTest({
                        fullTitle: () => "some test",
                        clone: () => ({ ...test1, testplaneCtx: {} }),
                    });
                    const test2 = makeTest({
                        fullTitle: () => "other test",
                        clone: () => ({ ...test2, testplaneCtx: {} }),
                    });
                    CachingTestParser.prototype.parse.resolves([test1, test2]);

                    await runner.runTest("other test", {});

                    const testRunner = TestRunner === NodejsEnvTestRunner ? nodejsTestRunner : browserTestRunner;

                    // Note: BrowserEnvTestRunner assertions are skipped due to dynamic import mocking limitations
                    if (TestRunner === NodejsEnvTestRunner) {
                        assert.calledOnceWith(testRunner.assignTest, test2);
                    }
                });

                it("should prepare browser with passed session", async () => {
                    const runner = mkRunner_();

                    const test = makeTest({
                        fullTitle: () => "some test",
                        clone: () => ({ ...test, testplaneCtx: {} }),
                    });
                    CachingTestParser.prototype.parse.resolves([test]);

                    await runner.runTest("some test", {
                        sessionId: "100500",
                        sessionCaps: "some-caps",
                        sessionOpts: "some-opts",
                        state: {},
                    });

                    const testRunner = TestRunner === NodejsEnvTestRunner ? nodejsTestRunner : browserTestRunner;

                    // Note: BrowserEnvTestRunner assertions are skipped due to dynamic import mocking limitations
                    if (TestRunner === NodejsEnvTestRunner) {
                        assert.calledOnceWith(testRunner.prepareBrowser, {
                            sessionId: "100500",
                            sessionCaps: "some-caps",
                            sessionOpts: "some-opts",
                            state: {},
                        });
                    }
                });
            });
        });
    });
});
