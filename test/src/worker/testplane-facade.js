"use strict";

const proxyquire = require("proxyquire");
const { AsyncEmitter } = require("src/events/async-emitter");
const { Testplane } = require("src/worker/testplane");
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
        sandbox.stub(Testplane, "create").returns(testplane);

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
});
