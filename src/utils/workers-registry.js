"use strict";

const { EventEmitter } = require("events");
const workerFarm = require("worker-farm");
const { promisify } = require("util");
const _ = require("lodash");
const { MasterEvents } = require("../events");
const RuntimeConfig = require("../config/runtime-config");
const { WorkerProcess } = require("./worker-process");
const logger = require("../utils/logger");
const {
    MASTER_INIT,
    MASTER_SYNC_CONFIG,
    WORKER_INIT,
    WORKER_SYNC_CONFIG,
    WORKER_UNHANDLED_REJECTION,
    TEST_ASSIGNED_TO_WORKER,
} = require("../constants/process-messages");
const { isRunInNodeJsEnv } = require("./config");
const { utilInspectSafe } = require("./secret-replacer");
const { NEW_ISSUE_LINK } = require("../constants/help");
const { deserializeWorkerError } = require("./worker-error-serialization");
const { randomUUID } = require("node:crypto");
const { noopProfilerRuntime } = require("../profiler/runtime/noop");
const {
    WORKER_PROFILER_BATCH,
    MASTER_PROFILER_FLUSH,
    WORKER_PROFILER_FLUSHED,
} = require("../constants/process-messages");

const PROFILER_FLUSH_TIMEOUT_MS = 1000;

const extractErrorFromWorkerMessage = data => {
    if (data.error) {
        let error = data.error;
        if (!(error instanceof Error)) {
            const errorTextLines = String(error).split("\n");
            error = new Error(errorTextLines[0]);
            error.stack = errorTextLines.slice(1).join("\n");
        }
        error.workerPid = data.workerPid;
        return error;
    }
    return null;
};

module.exports = class WorkersRegistry extends EventEmitter {
    static create(...args) {
        return new WorkersRegistry(...args);
    }

    constructor(config, profiler = noopProfilerRuntime) {
        super();
        this._config = config;
        this._ended = false;
        this._workerFarm = null;
        this._registeredWorkers = [];
        this._profiler = profiler;
        this._children = new Map();
        this._allChildren = new Set();
        this._workerSequence = 0;
        this._flushRequests = new Map();
        this._activeCalls = 0;
        this._peakActiveCalls = 0;
    }

    init() {
        if (this._workerFarm) {
            return;
        }

        this._workerFarm = this._createWorkerFarm();
    }

    async end() {
        this._ended = true;
        if (this._profiler.isEnabled()) {
            await this._flushProfiler();
        }
        await promisify(workerFarm.end)(this._workerFarm);
    }

    async shutdown() {
        if (this._profiler.isEnabled()) {
            await this._flushProfiler();
        }
        for (const child of this._allChildren) {
            child.kill();
        }
    }

    isEnded() {
        return this._ended;
    }

    register(workerFilepath, exportedMethods) {
        // For some reason, preloading modules causes running tests to hang up in browser env
        if (isRunInNodeJsEnv(this._config)) {
            this._workerFarm.loadModule(workerFilepath, _.noop);
        }

        const workers = new EventEmitter();
        this._registeredWorkers.push(workers);

        for (const methodName of exportedMethods) {
            workers[methodName] = (...args) => {
                if (this._ended) {
                    return Promise.reject(new Error(`Can't execute method '${methodName}' because worker farm ended.`));
                }
                const stack = new Error().stack;
                const profiling = this._profiler.isEnabled(2);
                const span = profiling
                    ? this._profiler.startSpan("worker.call", {
                          minLevel: 2,
                          name: methodName,
                          attributes: { method: methodName },
                      })
                    : null;
                if (profiling) {
                    this._activeCalls += 1;
                    this._peakActiveCalls = Math.max(this._peakActiveCalls, this._activeCalls);
                    this._profiler.sample("worker.activeCalls", this._activeCalls);
                    this._profiler.sample("worker.activeCalls.peak", this._peakActiveCalls);
                }
                const call = promisify(this._workerFarm.execute)(workerFilepath, methodName, args).catch(error => {
                    error = deserializeWorkerError(error);

                    if (error.name === "ProcessTerminatedError") {
                        const workerCallError = new Error(
                            `Testplane tried to run method '${methodName}' with args ${utilInspectSafe(
                                args,
                            )} in worker, but failed to do so.\n` +
                                `Most likely this happened due to a critical error in the worker like unhandled promise rejection or the worker process was terminated unexpectedly.\n` +
                                `Check surrounding logs for more details on the cause. If you believe this should not have happened, let us know: ${NEW_ISSUE_LINK}\n\n`,
                        );
                        try {
                            const nodeInternalLinesFilter = line => !/node:internal|node:events|node:domain/.test(line);
                            workerCallError.stack =
                                workerCallError.name +
                                stack.split("\n").slice(1).filter(nodeInternalLinesFilter).join("\n");
                            error.stack = error.stack.split("\n").filter(nodeInternalLinesFilter).join("\n");
                        } catch {
                            /* */
                        }
                        workerCallError.cause = error;

                        throw workerCallError;
                    }
                    throw error;
                });
                if (!profiling) {
                    return call;
                }
                const finishProfiling = status => {
                    span?.end(status);
                    this._activeCalls -= 1;
                    this._profiler.sample("worker.activeCalls", this._activeCalls);
                };
                return call.then(
                    result => {
                        finishProfiling();
                        return result;
                    },
                    error => {
                        finishProfiling("failed");
                        throw error;
                    },
                );
            };
        }

        return workers;
    }

    _createWorkerFarm() {
        const workerFilepath = require.resolve("./processor");

        const params = {
            maxConcurrentWorkers: this._config.system.workers,
            maxCallsPerWorker: this._config.system.testsPerWorker,
            maxConcurrentCallsPerWorker: Infinity,
            autoStart: true,
            maxRetries: 0,
            onChild: child => this._initChild(child),
            ...this._inspectParams(),
        };

        return workerFarm(params, workerFilepath, ["loadModule", "execute"]);
    }

    _inspectParams() {
        const runtimeConfig = RuntimeConfig.getInstance();

        if (!runtimeConfig || !runtimeConfig.inspectMode) {
            return;
        }

        const { inspect, inspectBrk } = runtimeConfig.inspectMode;

        const inspectName = inspectBrk ? "inspect-brk" : "inspect";
        let inspectValue = inspectBrk ? inspectBrk : inspect;

        inspectValue = typeof inspectValue === "string" ? `=${inspectValue}` : "";

        return {
            workerOptions: { execArgv: [`--${inspectName}${inspectValue}`] },
            maxConcurrentWorkers: 1,
            maxCallsPerWorker: Infinity,
        };
    }

    _initChild(child) {
        this._allChildren.add(child);
        const profiling = this._profiler.isEnabled();
        let workerInstanceId;
        let startupSpan;
        if (profiling) {
            this._workerSequence += 1;
            workerInstanceId = `worker-${this._workerSequence}-${child.pid}`;
            this._children.set(child.pid, { child, workerInstanceId });
            startupSpan = this._profiler.startSpan("worker.startup", {
                minLevel: 1,
                name: workerInstanceId,
                attributes: { workerInstanceId },
            });
        }

        child.once("exit", (code, signal) => {
            startupSpan?.end(code === 0 ? "completed" : "failed");
            this._children.delete(child.pid);
            this._allChildren.delete(child);
            if (code === 0) {
                return;
            }

            const errMsg = code === null ? `signal: ${signal}` : `exit code: ${code}`;
            if (profiling) {
                this._profiler.recordError(
                    "transport.workerExit",
                    new Error(`Worker ${workerInstanceId} terminated unexpectedly with ${errMsg}`),
                );
            }
            logger.error(`testplane:worker:${child.pid} terminated unexpectedly with ${errMsg}`);
        });

        child.on("message", (data = {}) => {
            switch (data.event) {
                case WORKER_INIT: {
                    startupSpan?.end();
                    const masterReceivedAtEpochMs = Date.now();
                    const workerSentAtEpochMs = data.profilerClock?.sentAtEpochMs;
                    const masterSentAtEpochMs = Date.now();
                    child.send({
                        event: MASTER_INIT,
                        configPath: this._config.configPath,
                        runtimeConfig: RuntimeConfig.getInstance(),
                        ...(this._profiler.isEnabled() && {
                            profiler: {
                                runId: this._profiler.runId,
                                level: this._profiler.level,
                                transportVersion: 1,
                                workerInstanceId,
                                ...(Number.isFinite(workerSentAtEpochMs) && {
                                    clockSync: {
                                        workerSentAtEpochMs,
                                        masterReceivedAtEpochMs,
                                        masterSentAtEpochMs,
                                    },
                                }),
                            },
                        }),
                    });
                    break;
                }
                case WORKER_SYNC_CONFIG:
                    child.send({
                        event: MASTER_SYNC_CONFIG,
                        config: this._config.serialize(),
                    });
                    break;
                case WORKER_UNHANDLED_REJECTION:
                    if (data.error) {
                        const error = extractErrorFromWorkerMessage(data);
                        this.emit(MasterEvents.ERROR, error);
                    }
                    break;
                case TEST_ASSIGNED_TO_WORKER:
                    if (this._profiler.isEnabled(2)) {
                        this._profiler.increment("worker.assigned", 1, { workerInstanceId });
                    }
                    this.emit(MasterEvents.TEST_ASSIGNED_TO_WORKER, data);
                    break;
                case WORKER_PROFILER_BATCH:
                    this._ingestProfilerMessage(data, { child, workerInstanceId }, "transport.batch.worker");
                    break;
                case WORKER_PROFILER_FLUSHED:
                    this._handleProfilerFlushed(data, { child, workerInstanceId });
                    break;
                case MasterEvents.DOM_SNAPSHOTS: {
                    this.emit(MasterEvents.DOM_SNAPSHOTS, data.context, data.data);
                    break;
                }
                case MasterEvents.ADD_FILE_TO_REMOVE: {
                    this.emit(MasterEvents.ADD_FILE_TO_REMOVE, data.data);
                    break;
                }
                case MasterEvents.TEST_DEPENDENCIES: {
                    this.emit(MasterEvents.TEST_DEPENDENCIES, data.context, data.data);
                    break;
                }
                default:
                    if (data.event) {
                        this._registeredWorkers.forEach(workers => workers.emit(data.event, _.omit(data, "event")));
                    }
                    break;
            }
        });

        this.emit(MasterEvents.NEW_WORKER_PROCESS, WorkerProcess.create(child));
    }

    async _flushProfiler() {
        if (!this._profiler.isEnabled() || !this._children.size) {
            return;
        }

        const requestId = randomUUID();
        const pendingPids = new Set(this._children.keys());
        await new Promise(resolve => {
            const timer = setTimeout(() => {
                const request = this._flushRequests.get(requestId);
                if (!request) {
                    return;
                }
                this._flushRequests.delete(requestId);
                if (request.pendingPids.size) {
                    this._profiler.recordError(
                        "transport.flush",
                        new Error(
                            `Timed out waiting for ${request.pendingPids.size} worker profiler flush response(s)`,
                        ),
                    );
                }
                resolve();
            }, PROFILER_FLUSH_TIMEOUT_MS);
            timer.unref();
            this._flushRequests.set(requestId, { pendingPids, resolve, timer });

            for (const { child } of this._children.values()) {
                try {
                    child.send({ event: MASTER_PROFILER_FLUSH, requestId });
                } catch (error) {
                    pendingPids.delete(child.pid);
                    this._profiler.recordError("transport.flush.send", error);
                }
            }

            if (!pendingPids.size) {
                clearTimeout(timer);
                this._flushRequests.delete(requestId);
                resolve();
            }
        });
    }

    _handleProfilerFlushed(data, { child, workerInstanceId }) {
        // Always ingest first: the flush waiter may already have timed out and been deleted.
        // Dropping a late fragment here reintroduces transport.gap / MISSING_PARENT under load.
        this._ingestProfilerMessage(data, { child, workerInstanceId }, "transport.flush.worker");

        const request = this._flushRequests.get(data.requestId);
        if (!request || !request.pendingPids.delete(child.pid)) {
            return;
        }

        if (!request.pendingPids.size) {
            clearTimeout(request.timer);
            this._flushRequests.delete(data.requestId);
            request.resolve();
        }
    }

    _ingestProfilerMessage(data, { child, workerInstanceId }, errorStage) {
        if (data.fragment) {
            data.fragment.process = { type: "worker", pid: child.pid, workerInstanceId };
            this._profiler.ingestFragment(data.fragment);
        }
        if (data.error) {
            this._profiler.recordError(errorStage, new Error(data.error));
        }
    }
};
