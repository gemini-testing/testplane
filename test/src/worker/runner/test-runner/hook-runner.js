"use strict";

const Promise = require("bluebird");
const HookRunner = require("src/worker/runner/test-runner/hook-runner");
const ExecutionThread = require("src/worker/runner/test-runner/execution-thread");
const { Suite, Test, Hook } = require("src/test-reader/test-object");

describe("worker/runner/test-runner/hook-runner", () => {
    const sandbox = sinon.sandbox.create();

    const mkHook_ = fn => {
        return new Hook({
            fn: fn || (() => {}),
        });
    };

    const mkSuite_ = (opts = {}) => {
        const suite = Suite.create();
        suite.parent = opts.parent;

        const convertHooks_ = (hooks = []) => hooks.map(fn => mkHook_(() => fn()));
        sandbox.stub(suite, "beforeEachHooks").get(() => convertHooks_(opts.beforeEachHooks));
        sandbox.stub(suite, "afterEachHooks").get(() => convertHooks_(opts.afterEachHooks));

        return suite;
    };

    const mkTest_ = (opts = {}) => {
        const test = Test.create({});
        test.parent = opts.parent || Suite.create();

        return test;
    };

    const mkRunner_ = (opts = {}) => {
        const test = opts.test || mkTest_();

        return HookRunner.create(test, Object.create(ExecutionThread.prototype));
    };

    beforeEach(() => {
        sandbox.stub(ExecutionThread.prototype, "run").callsFake(async runnable => {
            await runnable.fn();
        });
    });

    afterEach(() => sandbox.restore());

    describe("runBeforeEachHooks", () => {
        it("should run hook in execution thread", async () => {
            const hook = mkHook_();
            sandbox.stub(Suite.prototype, "beforeEachHooks").get(() => [hook]);

            await mkRunner_().runBeforeEachHooks();

            assert.calledWithMatch(ExecutionThread.prototype.run, hook);
        });

        it("should protect hook from modification during run in execution thread", async () => {
            const hook = mkHook_();
            sandbox.stub(Suite.prototype, "beforeEachHooks").get(() => [hook]);

            ExecutionThread.prototype.run.callsFake(hook => (hook.foo = "bar"));

            await mkRunner_().runBeforeEachHooks();

            assert.notProperty(hook, "foo");
        });

        it("should call beforeEach hooks for all parents", async () => {
            const topLevelHook1 = sinon.spy().named("topLevelHook1");
            const topLevelHook2 = sinon.spy().named("topLevelHook2");
            const hook1 = sinon.spy().named("hook1");
            const hook2 = sinon.spy().named("hook2");

            const test = mkTest_({
                parent: mkSuite_({
                    parent: mkSuite_({
                        beforeEachHooks: [topLevelHook1, topLevelHook2],
                    }),
                    beforeEachHooks: [hook1, hook2],
                }),
            });

            await mkRunner_({ test }).runBeforeEachHooks();

            assert.callOrder(topLevelHook1, topLevelHook2, hook1, hook2);
        });

        it("should wait until first hook finished before next hook started", async () => {
            const afterFirstHook = sinon.spy().named("afterFirstHook");
            const firstHook = sinon.stub().callsFake(() => Promise.delay(10).then(afterFirstHook));
            const secondHook = sinon.spy().named("secondHook");

            const test = mkTest_({
                parent: mkSuite_({
                    beforeEachHooks: [firstHook, secondHook],
                }),
            });

            await mkRunner_({ test }).runBeforeEachHooks();

            assert.callOrder(afterFirstHook, secondHook);
        });

        it("should wait until parent hook finished before child hook start", async () => {
            const afterParentHook = sinon.spy().named("afterParentHook");
            const parentHook = sinon.stub().callsFake(() => Promise.delay(10).then(afterParentHook));
            const childHook = sinon.spy().named("childHook");

            const test = mkTest_({
                parent: mkSuite_({
                    parent: mkSuite_({
                        beforeEachHooks: [parentHook],
                    }),
                    beforeEachHooks: [childHook],
                }),
            });

            await mkRunner_({ test }).runBeforeEachHooks();

            assert.callOrder(afterParentHook, childHook);
        });

        it("should fail on first hook fail", async () => {
            const secondParentHook = sinon.spy().named("secondParentHook");
            const childHook = sinon.spy().named("childHook");

            const test = mkTest_({
                parent: mkSuite_({
                    parent: mkSuite_({
                        beforeEachHooks: [() => Promise.reject(new Error("foo")), secondParentHook],
                    }),
                    beforeEachHooks: [childHook],
                }),
            });

            const runner = mkRunner_({ test });

            await assert.isRejected(runner.runBeforeEachHooks(), /foo/);
            assert.notCalled(secondParentHook);
            assert.notCalled(childHook);
        });
    });

    describe("runAfterEachHooks", () => {
        it("should run hook in execution thread", async () => {
            const hook = mkHook_();
            sandbox.stub(Suite.prototype, "afterEachHooks").get(() => [hook]);

            await mkRunner_().runAfterEachHooks();

            assert.calledWithMatch(ExecutionThread.prototype.run, hook);
        });

        it("should protect hook from modification during run in execution thread", async () => {
            const hook = mkHook_();
            sandbox.stub(Suite.prototype, "afterEachHooks").get(() => [hook]);

            ExecutionThread.prototype.run.callsFake(hook => (hook.foo = "bar"));

            await mkRunner_().runAfterEachHooks();

            assert.notProperty(hook, "foo");
        });

        it("should call afterEach hooks for all parents", async () => {
            const topLevelHook1 = sinon.spy().named("topLevelHook1");
            const topLevelHook2 = sinon.spy().named("topLevelHook2");
            const hook1 = sinon.spy().named("hook1");
            const hook2 = sinon.spy().named("hook2");

            const test = mkTest_({
                parent: mkSuite_({
                    parent: mkSuite_({
                        afterEachHooks: [topLevelHook1, topLevelHook2],
                    }),
                    afterEachHooks: [hook1, hook2],
                }),
            });

            await mkRunner_({ test }).runAfterEachHooks();

            assert.callOrder(hook1, hook2, topLevelHook1, topLevelHook2);
        });

        it("should wait until first hook finished before next hook started", async () => {
            const afterFirstHook = sinon.spy().named("afterFirstHook");
            const firstHook = sinon.stub().callsFake(() => Promise.delay(10).then(afterFirstHook));
            const secondHook = sinon.spy().named("secondHook");

            const test = mkTest_({
                parent: mkSuite_({
                    afterEachHooks: [firstHook, secondHook],
                }),
            });

            await mkRunner_({ test }).runAfterEachHooks();

            assert.callOrder(afterFirstHook, secondHook);
        });

        it("should wait until child hook finished before parent hook start", async () => {
            const afterChildHook = sinon.spy().named("afterChildHook");
            const childHook = sinon.stub().callsFake(() => Promise.delay(10).then(afterChildHook));
            const parentHook = sinon.spy().named("parentHook");

            const test = mkTest_({
                parent: mkSuite_({
                    parent: mkSuite_({
                        afterEachHooks: [parentHook],
                    }),
                    afterEachHooks: [childHook],
                }),
            });

            await mkRunner_({ test }).runAfterEachHooks();

            assert.callOrder(afterChildHook, parentHook);
        });

        it("should fail on first hook fail in suite", async () => {
            const secondHook = sinon.spy().named("secondHook");

            const test = mkTest_({
                parent: mkSuite_({
                    afterEachHooks: [() => Promise.reject(new Error("foo")), secondHook],
                }),
            });

            const runner = mkRunner_({ test });

            await assert.isRejected(runner.runAfterEachHooks(), /foo/);
            assert.notCalled(secondHook);
        });

        it("should run parent hook even if child hook failed", async () => {
            const parentHook = sinon.spy().named("parentHook");

            const test = mkTest_({
                parent: mkSuite_({
                    parent: mkSuite_({
                        afterEachHooks: [parentHook],
                    }),
                    afterEachHooks: [() => Promise.reject(new Error("foo"))],
                }),
            });

            const runner = mkRunner_({ test });

            await assert.isRejected(runner.runAfterEachHooks(), /foo/);
            assert.calledOnce(parentHook);
        });

        it("should reject with child hook error if both child and parent hooks failed", async () => {
            const test = mkTest_({
                parent: mkSuite_({
                    parent: mkSuite_({
                        afterEachHooks: [() => Promise.reject(new Error("bar"))],
                    }),
                    afterEachHooks: [() => Promise.reject(new Error("foo"))],
                }),
            });

            const runner = mkRunner_({ test });

            await assert.isRejected(runner.runAfterEachHooks(), /foo/);
        });

        it("should run only parent afterEach hook if parent beforeEach hook failed", async () => {
            const parentHook = sinon.spy().named("parentHook");
            const childHook = sinon.spy().named("childHook");

            const test = mkTest_({
                parent: mkSuite_({
                    parent: mkSuite_({
                        beforeEachHooks: [() => Promise.reject(new Error())],
                        afterEachHooks: [parentHook],
                    }),
                    afterEachHooks: [childHook],
                }),
            });

            const runner = mkRunner_({ test });
            await runner.runBeforeEachHooks().catch(() => {});

            await runner.runAfterEachHooks();

            assert.calledOnce(parentHook);
            assert.notCalled(childHook);
        });
    });
});
