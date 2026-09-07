"use strict";

const proxyquire = require("proxyquire");
const { EventEmitter } = require("events");
const _ = require("lodash");
const RuntimeConfig = require("src/config/runtime-config");
const { MasterEvents: Events } = require("src/events");
const { WorkerProcess } = require("src/utils/worker-process");
const { SERIALIZED_ERROR_MARKER } = require("src/utils/worker-error-serialization");
const {
    MASTER_INIT,
    MASTER_SYNC_CONFIG,
    WORKER_INIT,
    WORKER_SYNC_CONFIG,
    WORKER_UNHANDLED_REJECTION,
    WORKER_PROFILER_BATCH,
    MASTER_PROFILER_FLUSH,
    WORKER_PROFILER_FLUSHED,
} = require("src/constants/process-messages");

describe("WorkersRegistry", () => {
    const sandbox = sinon.createSandbox();

    let workersImpl, workerFarm, loggerErrorStub;

    const mkWorkersRegistry_ = (config = {}, profiler) => {
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
        const workersRegistry = profiler ? WorkersRegistry.create(config, profiler) : WorkersRegistry.create(config);
        workersRegistry.init();

        return workersRegistry;
    };

    const initChild_ = pid => {
        const { onChild } = workerFarm.firstCall.args[0];

        const child = new EventEmitter();
        child.pid = pid;
        child.send = sandbox.stub();
        child.kill = sandbox.stub();
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

        it("should include midpoint clock samples in profiler worker init", () => {
            const clock = sinon.useFakeTimers({ now: 1_120 });
            try {
                const profiler = {
                    isEnabled: sinon.stub().returns(true),
                    startSpan: sinon.stub().returns({ end: sinon.stub() }),
                    runId: "run",
                    level: 2,
                };
                mkWorkersRegistry_({ configPath: "foo/bar" }, profiler);
                const child = initChild_(12345);

                child.emit("message", {
                    event: WORKER_INIT,
                    profilerClock: { sentAtEpochMs: 1_000 },
                });

                assert.calledOnceWith(
                    child.send,
                    sinon.match({
                        event: MASTER_INIT,
                        profiler: sinon.match({
                            clockSync: {
                                workerSentAtEpochMs: 1_000,
                                masterReceivedAtEpochMs: 1_120,
                                masterSentAtEpochMs: 1_120,
                            },
                        }),
                    }),
                );
            } finally {
                clock.restore();
            }
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

            const calledArgs = onError.getCall(0).args;
            assert.equal(calledArgs[0].message, errorMsg);
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

        it("should ingest a profiler batch and surface a worker-side collection error", () => {
            const profiler = {
                isEnabled: sinon.stub().returns(true),
                startSpan: sinon.stub().returns({ end: sinon.stub() }),
                ingestFragment: sinon.stub(),
                recordError: sinon.stub(),
            };
            mkWorkersRegistry_({}, profiler);
            const child = initChild_(12345);
            const fragment = { transportVersion: 1 };

            child.emit("message", { event: WORKER_PROFILER_BATCH, fragment });
            child.emit("message", { event: WORKER_PROFILER_BATCH, error: "collection failed" });

            assert.calledOnceWith(profiler.ingestFragment, fragment);
            assert.deepEqual(fragment.process, {
                type: "worker",
                pid: 12345,
                workerInstanceId: "worker-1-12345",
            });
            assert.calledOnceWith(
                profiler.recordError,
                "transport.batch.worker",
                sinon.match.has("message", "collection failed"),
            );
        });

        it("should ingest late profiler flush fragments after the flush waiter timed out", async () => {
            const clock = sinon.useFakeTimers();
            try {
                const profiler = {
                    isEnabled: sinon.stub().returns(true),
                    startSpan: sinon.stub().returns({ end: sinon.stub() }),
                    ingestFragment: sinon.stub(),
                    recordError: sinon.stub(),
                    runId: "run",
                    level: 2,
                };
                const workersRegistry = mkWorkersRegistry_({}, profiler);
                const child = initChild_(12345);
                const fragment = { transportVersion: 1, sequence: 1 };

                const endPromise = workersRegistry.end();
                assert.calledWith(child.send, sinon.match({ event: MASTER_PROFILER_FLUSH }));
                const { requestId } = child.send
                    .getCalls()
                    .map(call => call.args[0])
                    .find(message => message.event === MASTER_PROFILER_FLUSH);

                await clock.tickAsync(1000);
                await endPromise;

                assert.calledWith(
                    profiler.recordError,
                    "transport.flush",
                    sinon.match.has("message", sinon.match("Timed out")),
                );
                assert.notCalled(profiler.ingestFragment);

                child.emit("message", { event: WORKER_PROFILER_FLUSHED, requestId, fragment });

                assert.calledOnceWith(profiler.ingestFragment, fragment);
                assert.deepEqual(fragment.process, {
                    type: "worker",
                    pid: 12345,
                    workerInstanceId: "worker-1-12345",
                });
            } finally {
                clock.restore();
            }
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

        it("should deserialize error with nested cause from worker", async () => {
            const workersRegistry = mkWorkersRegistry_();
            const workers = workersRegistry.register("worker.js", ["runTest"]);
            workersImpl.execute.yieldsRight({
                [SERIALIZED_ERROR_MARKER]: true,
                name: "Error",
                message: "outer",
                stack: "Error: outer",
                testplaneCtx: { foo: "bar" },
                cause: {
                    [SERIALIZED_ERROR_MARKER]: true,
                    name: "TypeError",
                    message: "inner",
                    stack: "TypeError: inner",
                },
            });

            let error;
            try {
                await workers.runTest("foo", { bar: "baz" });
            } catch (err) {
                error = err;
            }

            assert.instanceOf(error, Error);
            assert.equal(error.message, "outer");
            assert.deepEqual(error.testplaneCtx, { foo: "bar" });
            assert.instanceOf(error.cause, Error);
            assert.equal(error.cause.name, "TypeError");
            assert.equal(error.cause.message, "inner");
            assert.equal(error.cause.stack, "TypeError: inner");
            assert.deepEqual(Object.keys(error), ["testplaneCtx"]);
        });
    });

    describe("end", () => {
        it("should end created worker farm", async () => {
            await mkWorkersRegistry_().end();

            assert.calledOnceWith(workerFarm.end, workersImpl);
        });

        it("should become ended synchronously before level-zero shutdown", async () => {
            const workersRegistry = mkWorkersRegistry_();

            const endPromise = workersRegistry.end();

            assert.isTrue(workersRegistry.isEnded());
            await endPromise;
        });
    });

    describe("shutdown", () => {
        it("should kill children synchronously when profiling is disabled", async () => {
            const workersRegistry = mkWorkersRegistry_();
            const child = initChild_(12345);

            const shutdownPromise = workersRegistry.shutdown();

            assert.calledOnce(child.kill);
            await shutdownPromise;
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

            it("profiler partial marker", () => {
                const profiler = {
                    isEnabled: sinon.stub().returns(true),
                    startSpan: sinon.stub().returns({ end: sinon.stub() }),
                    recordError: sinon.stub(),
                };
                mkWorkersRegistry_({}, profiler);
                const child = initChild_(12345);

                child.emit("exit", 1, null);

                assert.calledOnceWith(
                    profiler.recordError,
                    "transport.workerExit",
                    sinon.match.has("message", sinon.match("worker-1-12345")),
                );
            });
        });
    });
});
