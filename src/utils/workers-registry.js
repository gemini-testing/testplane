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

    constructor(config) {
        super();
        this._config = config;
        this._ended = false;
        this._workerFarm = null;
        this._registeredWorkers = [];
    }

    init() {
        if (this._workerFarm) {
            return;
        }

        this._workerFarm = this._createWorkerFarm();
    }

    async end() {
        this._ended = true;
        await promisify(workerFarm.end)(this._workerFarm);
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
                return promisify(this._workerFarm.execute)(workerFilepath, methodName, args).catch(error => {
                    if (error.name === "ProcessTerminatedError") {
                        const workerCallError = new Error(
                            `Testplane tried to run method '${methodName}' with args ${utilInspectSafe(
                                args,
                            )} in worker, but failed to do so.\n` +
                                `Most likely this happened due to a critical error in the worker like unhandled promise rejection or the worker process was terminated unexpectedly.\n` +
                                `Check surrounding logs for more details on the cause. If you believe this should not have happened, let us know: ${NEW_ISSUE_LINK}\n\n`,
                        );
                        try {
                            workerCallError.stack = workerCallError.name + stack.split("\n").slice(1).join("\n");
                        } catch {
                            /* */
                        }
                        workerCallError.cause = error;

                        throw workerCallError;
                    }
                    throw error;
                });
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
        child.once("exit", (code, signal) => {
            if (code === 0) {
                return;
            }

            const errMsg = code === null ? `signal: ${signal}` : `exit code: ${code}`;
            logger.error(`testplane:worker:${child.pid} terminated unexpectedly with ${errMsg}`);
        });

        child.on("message", (data = {}) => {
            switch (data.event) {
                case WORKER_INIT:
                    child.send({
                        event: MASTER_INIT,
                        configPath: this._config.configPath,
                        runtimeConfig: RuntimeConfig.getInstance(),
                    });
                    break;
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
                    this.emit(MasterEvents.TEST_ASSIGNED_TO_WORKER, data);
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
};
