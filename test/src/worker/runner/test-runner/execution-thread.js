"use strict";

const Promise = require("bluebird");
const _ = require("lodash");

const AssertViewResults = require("src/browser/commands/assert-view/assert-view-results");
const ExecutionThread = require("src/worker/runner/test-runner/execution-thread");
const OneTimeScreenshooter = require("src/worker/runner/test-runner/one-time-screenshooter");
const { Test } = require("src/test-reader/test-object");

describe("worker/runner/test-runner/execution-thread", () => {
    const sandbox = sinon.sandbox.create();

    const mkTest_ = (opts = {}) => {
        opts.fn = opts.fn || sinon.spy();
        return Test.create(opts);
    };

    const mkRunnable_ = (opts = {}) => {
        return {
            type: "default-runnable-type",
            fn: sinon.spy(),
            timeout: 0,
            fullTitle: sinon.stub().returns(""),
            ...opts,
        };
    };

    const mkBrowser_ = (config = {}) => {
        return {
            config,
            publicAPI: Object.create({
                getCommandHistory: sinon.stub().resolves([]),
            }),
        };
    };

    const mkExecutionThread_ = (opts = {}) => {
        const test = opts.test || mkTest_();
        const browser = opts.browser || mkBrowser_();
        const hermioneCtx = opts.hermioneCtx || {};
        const screenshooter = opts.screenshooter || Object.create(OneTimeScreenshooter.prototype);

        return ExecutionThread.create({ test, browser, hermioneCtx, screenshooter });
    };

    beforeEach(() => {
        sandbox.stub(OneTimeScreenshooter.prototype, "extendWithScreenshot").callsFake(e => Promise.resolve(e));
        sandbox.stub(OneTimeScreenshooter.prototype, "captureScreenshotOnAssertViewFail").resolves();
    });

    afterEach(() => sandbox.restore());

    describe("run", () => {
        describe("context", () => {
            it("should run all runnables with the same context", async () => {
                const firstRunnable = mkRunnable_();
                const secondRunnable = mkRunnable_();

                const executionThread = mkExecutionThread_();

                await executionThread.run(firstRunnable);
                await executionThread.run(secondRunnable);

                assert.equal(firstRunnable.fn.firstCall.thisValue, secondRunnable.fn.firstCall.thisValue);
            });

            it("should set browser public API to runnable fn context", async () => {
                const browser = mkBrowser_();
                const runnable = mkRunnable_();

                await mkExecutionThread_({ browser }).run(runnable);

                assert.calledOn(runnable.fn, sinon.match({ browser: browser.publicAPI }));
            });

            it("should set current test to runnable fn context", async () => {
                const test = mkTest_({ title: "some test" });
                const executionThread = mkExecutionThread_({ test });

                const runnable = mkRunnable_();

                await executionThread.run(runnable);

                assert.calledOn(runnable.fn, sinon.match({ currentTest: { title: "some test" } }));
            });
        });

        describe("params", () => {
            it("should run all runnables with the same params", async () => {
                const firstRunnable = mkRunnable_();
                const secondRunnable = mkRunnable_();

                const executionThread = mkExecutionThread_();

                await executionThread.run(firstRunnable);
                await executionThread.run(secondRunnable);

                assert.equal(firstRunnable.fn.firstCall.args[0], secondRunnable.fn.firstCall.args[0]);
            });

            it("should pass browser public API to runnable fn", async () => {
                const browser = mkBrowser_();
                const runnable = mkRunnable_();

                await mkExecutionThread_({ browser }).run(runnable);

                assert.calledWith(runnable.fn, sinon.match({ browser: browser.publicAPI }));
            });

            it("should pass current test to runnable fn", async () => {
                const test = mkTest_({ title: "some test" });
                const executionThread = mkExecutionThread_({ test });

                const runnable = mkRunnable_();

                await executionThread.run(runnable);

                assert.calledWith(runnable.fn, sinon.match({ currentTest: { title: "some test" } }));
            });
        });

        it("should reject on runnable reject", async () => {
            const runnable = mkRunnable_({
                fn: () => Promise.reject(new Error("foo")),
            });
            const executionThread = mkExecutionThread_();

            await assert.isRejected(executionThread.run(runnable), /foo/);
        });

        it("should store error in current test on runnable reject", async () => {
            const test = mkTest_();
            const runnable = mkRunnable_({
                fn: () => Promise.reject(new Error("foo")),
            });

            const e = await mkExecutionThread_({ test })
                .run(runnable)
                .catch(e => e);

            assert.equal(test.err, e);
        });

        it("should not override error in current test on runnable reject", async () => {
            const origError = new Error("bar");
            const test = mkTest_();
            test.err = origError;

            const runnable = mkRunnable_({
                fn: () => Promise.reject(new Error("foo")),
            });

            await mkExecutionThread_({ test })
                .run(runnable)
                .catch(e => e);

            assert.equal(test.err, origError);
        });

        it("should set runnable as browser execution context", async () => {
            let executionContext;
            const runnable = mkRunnable_({
                title: "some hook",
                fn: function () {
                    executionContext = this.browser.executionContext;
                },
            });

            await mkExecutionThread_().run(runnable);

            assert.propertyVal(executionContext, "title", "some hook");
        });

        it("should set runnable ctx to browser execution context", async () => {
            let _this;
            let executionContext;
            const runnable = mkRunnable_({
                fn: function () {
                    _this = this; // eslint-disable-line @typescript-eslint/no-this-alias
                    executionContext = this.browser.executionContext;
                },
            });

            await mkExecutionThread_().run(runnable);

            assert.propertyVal(executionContext, "ctx", _this);
        });

        it("should share hermioneCtx in browser execution context between all runnables", async () => {
            const hermioneCtx = {};
            const executionThread = mkExecutionThread_({ hermioneCtx });

            await executionThread.run(
                mkRunnable_({
                    fn: function () {
                        this.browser.executionContext.hermioneCtx.foo = "bar";
                    },
                }),
            );
            await executionThread.run(
                mkRunnable_({
                    fn: function () {
                        this.browser.executionContext.hermioneCtx.baz = "qux";
                    },
                }),
            );

            assert.deepEqual(hermioneCtx, { foo: "bar", baz: "qux" });
        });

        it("should fail with timeout error on timeout", async () => {
            const runnable = mkRunnable_({
                type: "test",
                fullTitle: () => "bla bla",
                fn: () => Promise.delay(20),
                timeout: 10,
            });

            const executionThread = mkExecutionThread_();

            await assert.isRejected(executionThread.run(runnable), /test 'bla bla' timed out/);
        });

        it("should not set timeout if timeouts are disabled", async () => {
            const runnable = mkRunnable_({
                type: "test",
                fn: () => Promise.delay(20),
                timeout: 0,
            });

            const executionThread = mkExecutionThread_();

            await assert.isFulfilled(executionThread.run(runnable));
        });

        describe("takeScreenshotOnFails", () => {
            it("should extend error with screenshot", async () => {
                const originalError = new Error();
                const runnable = mkRunnable_({
                    fn: () => Promise.reject(originalError),
                });
                OneTimeScreenshooter.prototype.extendWithScreenshot.withArgs(originalError).callsFake(e => {
                    return Promise.resolve(_.extend(e, { screenshot: "screenshot" }));
                });

                const error = await mkExecutionThread_()
                    .run(runnable)
                    .catch(e => e);

                assert.propertyVal(error, "screenshot", "screenshot");
            });

            it("should try to capture screenshot on test error", async () => {
                const error = new Error();
                const runnable = mkRunnable_({
                    fn: () => Promise.reject(error),
                });

                await mkExecutionThread_()
                    .run(runnable)
                    .catch(e => e);

                assert.calledOnceWith(OneTimeScreenshooter.prototype.extendWithScreenshot, error);
            });

            it("should try to capture screenshot on test fail with assert view errors", async () => {
                const runnable = mkRunnable_({
                    fn: () => Promise.resolve(),
                });
                const assertViewResults = AssertViewResults.create([new Error()]);
                const hermioneCtx = { assertViewResults };

                await mkExecutionThread_({ hermioneCtx }).run(runnable);

                assert.calledOnce(OneTimeScreenshooter.prototype.captureScreenshotOnAssertViewFail);
            });

            it("should wait until screenshot will be taken", async () => {
                const afterScreenshot = sinon.spy().named("afterScreenshot");
                OneTimeScreenshooter.prototype.extendWithScreenshot.callsFake(() =>
                    Promise.delay(10).then(afterScreenshot),
                );

                const runnable = mkRunnable_({
                    fn: () => Promise.reject(new Error()),
                });

                await mkExecutionThread_()
                    .run(runnable)
                    .catch(() => {});

                assert.calledOnce(afterScreenshot);
            });

            it("runnable should not fail with timeout while taking screenshot", async () => {
                const runnable = mkRunnable_({
                    fn: () => Promise.reject(new Error("foo")),
                    timeout: 10,
                });

                OneTimeScreenshooter.prototype.extendWithScreenshot.callsFake(() => Promise.delay(20));

                const executionThread = mkExecutionThread_();

                await assert.isRejected(executionThread.run(runnable), /foo/);
            });
        });
    });
});
