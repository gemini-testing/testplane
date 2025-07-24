"use strict";

const proxyquire = require("proxyquire");
const { EventEmitter } = require("events");
const _ = require("lodash");
const RuntimeConfig = require("src/config/runtime-config");
const { MasterEvents: Events } = require("src/events");
const { WorkerProcess } = require("src/utils/worker-process");
const {
    MASTER_INIT,
    MASTER_SYNC_CONFIG,
    WORKER_INIT,
    WORKER_SYNC_CONFIG,
    WORKER_UNHANDLED_REJECTION,
} = require("src/constants/process-messages");

describe("WorkersRegistry", () => {
    const sandbox = sinon.createSandbox();

    let workersImpl, workerFarm, loggerErrorStub;

    const mkWorkersRegistry_ = (config = {}) => {
        config = _.defaults(config, {
            system: {},
        });
        loggerErrorStub = sandbox.stub();

        const WorkersRegistry = proxyquire("../../../src/utils/workers-registry", {
            "worker-farm": workerFarm,
            "../utils/logger": {
                error: loggerErrorStub,
            },
        });
        const workersRegistry = WorkersRegistry.create(config);
        workersRegistry.init();

        return workersRegistry;
    };

    const initChild_ = () => {
        const { onChild } = workerFarm.firstCall.args[0];

        const child = new EventEmitter();
        child.send = sandbox.stub();
        onChild(child);

        return child;
    };

    beforeEach(() => {
        workersImpl = {
            loadModule: sandbox.stub(),
            execute: sandbox.stub().yieldsRight(),
        };
        workerFarm = sandbox.stub().returns(workersImpl);

        workerFarm.end = sandbox.stub().yieldsRight();

        sandbox.stub(RuntimeConfig, "getInstance");
    });

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        it("should init worker farm", () => {
            mkWorkersRegistry_({
                system: {
                    workers: 100500,
                    testsPerWorker: 500100,
                },
            });

            assert.calledOnceWith(
                workerFarm,
                {
                    maxConcurrentWorkers: 100500,
                    maxCallsPerWorker: 500100,
                    maxConcurrentCallsPerWorker: Infinity,
                    autoStart: true,
                    maxRetries: 0,
                    onChild: sinon.match.func,
                },
                sinon.match("src/utils/processor.js"),
            );
        });

        it("should init worker farm in debug mode", () => {
            RuntimeConfig.getInstance.returns({ inspectMode: { inspect: "9229" } });

            mkWorkersRegistry_({
                system: {
                    workers: 100500,
                    testsPerWorker: 500100,
                },
            });

            assert.calledOnceWith(
                workerFarm,
                {
                    workerOptions: { execArgv: ["--inspect=9229"] },
                    maxConcurrentWorkers: 1,
                    maxCallsPerWorker: Infinity,
                    maxConcurrentCallsPerWorker: Infinity,
                    autoStart: true,
                    maxRetries: 0,
                    onChild: sinon.match.func,
                },
                sinon.match("src/utils/processor.js"),
            );
        });
    });

    describe("communication with worker", () => {
        it("should reply to worker init request", () => {
            RuntimeConfig.getInstance.returns({ baz: "qux" });
            mkWorkersRegistry_({ configPath: "foo/bar" });

            const child = initChild_();

            child.emit("message", { event: WORKER_INIT });

            assert.calledOnceWith(child.send, {
                event: MASTER_INIT,
                configPath: "foo/bar",
                runtimeConfig: { baz: "qux" },
            });
        });

        it("should reply to worker sync config request", () => {
            mkWorkersRegistry_({
                serialize: () => ({ foo: "bar" }),
            });

            const child = initChild_();

            child.emit("message", { event: WORKER_SYNC_CONFIG });

            assert.calledOnceWith(child.send, {
                event: MASTER_SYNC_CONFIG,
                config: { foo: "bar" },
            });
        });

        it('should emit "ERROR" event on unhandled rejection from worker', () => {
            const workersRegistry = mkWorkersRegistry_();
            const onError = sinon.stub().named("onError");
            workersRegistry.on(Events.ERROR, onError);

            const child = initChild_();
            const errorMsg = "o.O";

            child.emit("message", { event: WORKER_UNHANDLED_REJECTION, error: errorMsg });

            assert.calledOnceWith(onError, errorMsg);
        });

        describe("other events", () => {
            it("should emit one event through workers object", () => {
                const workersRegistry = mkWorkersRegistry_();
                const workers = workersRegistry.register(null, []);
                const child = initChild_();

                const onEvent = sandbox.stub().named("onEvent");
                workers.once("foo", onEvent);
                child.emit("message", { event: "foo", bar: "baz" });

                assert.calledOnceWith(onEvent, { bar: "baz" });
            });

            it("should emit few events sequentially through workers object", () => {
                const workersRegistry = mkWorkersRegistry_();
                const workers = workersRegistry.register(null, []);
                const child = initChild_();

                const onFooEvent = sandbox.stub().named("onFooEvent");
                workers.once("foo", onFooEvent);
                child.emit("message", { event: "foo", bar: "baz" });

                const onBarEvent = sandbox.stub().named("onBarEvent");
                workers.once("bar", onBarEvent);
                child.emit("message", { event: "bar", baz: "qux" });

                assert.calledOnceWith(onFooEvent, { bar: "baz" });
                assert.calledOnceWith(onBarEvent, { baz: "qux" });
            });
        });

        it("should not emit unknown events (without event field) through workers object", () => {
            const workersRegistry = mkWorkersRegistry_();
            const workers = workersRegistry.register(null, []);

            const onEvent = sandbox.stub().named("onEvent");
            workers.on("foo", onEvent);

            const child = initChild_();
            child.emit("message", { foo: "bar" });

            assert.notCalled(onEvent);
        });
    });

    describe("execute worker's method", () => {
        it("should run test in worker", () => {
            const workersRegistry = mkWorkersRegistry_();
            const workers = workersRegistry.register("worker.js", ["runTest"]);

            return workers
                .runTest("foo", { bar: "baz" })
                .then(() =>
                    assert.calledOnceWith(workersImpl.execute, "worker.js", "runTest", ["foo", { bar: "baz" }]),
                );
        });
    });

    describe("end", () => {
        it("should end created worker farm", async () => {
            await mkWorkersRegistry_().end();

            assert.calledOnceWith(workerFarm.end, workersImpl);
        });
    });

    describe("isEnded", () => {
        it("should return false when worker farm is not ended", () => {
            const workersRegistry = mkWorkersRegistry_();
            workersRegistry.register("worker.js", ["runTest"]);

            assert.isFalse(workersRegistry.isEnded());
        });

        it("should return true when worker farm is ended", async () => {
            const workersRegistry = mkWorkersRegistry_();
            workersRegistry.register("worker.js", ["runTest"]);

            await workersRegistry.end();

            assert.isTrue(workersRegistry.isEnded());
        });
    });

    describe("NEW_WORKER_PROCESS event", () => {
        it("should pass a worker process instance", () => {
            const onNewWorkerProcess = sinon.stub().named("onNewWorkerProcess");
            const workersRegistry = mkWorkersRegistry_();
            workersRegistry.on(Events.NEW_WORKER_PROCESS, onNewWorkerProcess);
            const workerProcessStub = sinon.stub().named("workerProcess");
            sinon.stub(WorkerProcess, "create").returns(workerProcessStub);

            const child = initChild_();

            assert.calledOnceWith(onNewWorkerProcess, workerProcessStub);
            assert.calledOnceWith(WorkerProcess.create, child);
        });
    });

    describe("child process termination", () => {
        it("should not inform about error in child process if it ends correctly", () => {
            mkWorkersRegistry_();
            const child = initChild_();

            child.emit("exit", 0, null);

            assert.notCalled(loggerErrorStub);
        });

        describe("should inform about incorrect ends of child process with", () => {
            it("exit code", () => {
                mkWorkersRegistry_();
                const child = initChild_();
                child.pid = "12345";

                child.emit("exit", 1, null);

                assert.calledOnceWith(
                    loggerErrorStub,
                    `testplane:worker:${child.pid} terminated unexpectedly with exit code: 1`,
                );
            });

            it("signal", () => {
                mkWorkersRegistry_();
                const child = initChild_();
                child.pid = "12345";

                child.emit("exit", null, "SIGINT");

                assert.calledOnceWith(
                    loggerErrorStub,
                    `testplane:worker:${child.pid} terminated unexpectedly with signal: SIGINT`,
                );
            });
        });
    });
});
