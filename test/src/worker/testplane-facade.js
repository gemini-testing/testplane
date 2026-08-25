"use strict";

const proxyquire = require("proxyquire");
const { AsyncEmitter } = require("src/events/async-emitter");
const { Testplane } = require("src/worker/testplane");
const RuntimeConfig = require("src/config/runtime-config");
const { makeConfigStub } = require("../../utils");
const ipc = require("src/utils/ipc");
const TestplaneFacade = require("src/worker/testplane-facade");
const { MASTER_INIT, MASTER_SYNC_CONFIG } = require("src/constants/process-messages");

describe("worker/testplane-facade", () => {
    const sandbox = sinon.createSandbox();
    let testplane;
    let testplaneFacade;

    beforeEach(() => {
        const config = makeConfigStub();

        sandbox.stub(ipc);
        ipc.on.withArgs(MASTER_INIT).yieldsAsync({ runtimeConfig: {} });
        ipc.on.withArgs(MASTER_SYNC_CONFIG).yieldsAsync({ config });

        sandbox.spy(TestplaneFacade.prototype, "syncConfig");

        testplane = Object.assign(new AsyncEmitter(), {
            init: sandbox.spy().named("testplaneInit"),
            config,
        });
        sandbox.stub(Testplane, "create").resolves(testplane);

        testplaneFacade = TestplaneFacade.create();
    });

    afterEach(() => sandbox.restore());

    describe("init", () => {
        it("should init testplane", async () => {
            await testplaneFacade.init();

            assert.calledOnce(testplane.init);
        });

        it("should not sync config", async () => {
            await testplaneFacade.init();

            assert.notCalled(TestplaneFacade.prototype.syncConfig);
        });

        it("should require passed modules", async () => {
            const requireModule = sinon.stub();
            const TestplaneFacadeModule = proxyquire("src/worker/testplane-facade", {
                "../utils/module": { requireModule },
            });

            ipc.on.withArgs(MASTER_INIT).yieldsAsync({
                runtimeConfig: { requireModules: ["foo"] },
            });

            await TestplaneFacadeModule.create().init();

            assert.calledOnceWith(requireModule, "foo");
        });

        it("should create worker Testplane with the master profiler run id", async () => {
            ipc.on.withArgs(MASTER_INIT).yieldsAsync({
                configPath: "testplane.config.js",
                runtimeConfig: {},
                profiler: { runId: "master-run", workerInstanceId: "worker-7" },
            });

            await testplaneFacade.init();

            assert.calledOnceWith(
                Testplane.create,
                "testplane.config.js",
                undefined,
                sinon.match({
                    runId: "master-run",
                    process: sinon.match({ type: "worker", workerInstanceId: "worker-7" }),
                }),
            );
        });

        it("should align the worker profiler clock using midpoint timestamps", async () => {
            sandbox.stub(Date, "now").returns(1_042);
            ipc.on.withArgs(MASTER_INIT).yieldsAsync({
                configPath: "testplane.config.js",
                runtimeConfig: {},
                profiler: {
                    runId: "master-run",
                    workerInstanceId: "worker-7",
                    clockSync: {
                        workerSentAtEpochMs: 1_000,
                        masterReceivedAtEpochMs: 1_120,
                        masterSentAtEpochMs: 1_122,
                    },
                },
            });

            await testplaneFacade.init();

            assert.calledOnceWith(
                Testplane.create,
                "testplane.config.js",
                undefined,
                sinon.match({
                    clockOffsetMs: 100,
                    clockUncertaintyMs: 20,
                }),
            );
        });
    });

    describe("runTest", () => {
        beforeEach(() => {
            testplane.runTest = sandbox.spy().named("testplaneRunTest");
        });

        it("should init testplane before running test", async () => {
            await testplaneFacade.runTest();

            assert.callOrder(testplane.init, testplane.runTest);
        });

        it("should sync config before running test", async () => {
            await testplaneFacade.runTest();

            assert.callOrder(TestplaneFacade.prototype.syncConfig, testplane.runTest);
        });
    });

    describe("cancel", () => {
        beforeEach(() => {
            sandbox.stub(RuntimeConfig, "getInstance").returns({});
        });

        it("should not throw if repl server is not exists in runtime config", () => {
            assert.doesNotThrow(() => testplaneFacade.cancel());
        });

        it("should close repl server if it exists in runtime config", () => {
            const replServer = { close: sandbox.stub() };
            RuntimeConfig.getInstance.returns({ replServer });

            testplaneFacade.cancel();

            assert.calledOnceWithExactly(replServer.close);
        });
    });
});
