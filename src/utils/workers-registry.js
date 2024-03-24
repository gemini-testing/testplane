import { EventEmitter } from "node:events";
import workerFarm from "worker-farm";
import Promise from "bluebird";
import _ from "lodash";

import { MasterEvents } from "../events/index.js";
import * as RuntimeConfig from "../config/runtime-config.js";
import { WorkerProcess } from "./worker-process.js";
import logger from "../utils/logger.js";
import {
    MASTER_INIT,
    MASTER_SYNC_CONFIG,
    WORKER_INIT,
    WORKER_SYNC_CONFIG,
    WORKER_UNHANDLED_REJECTION,
} from "../constants/process-messages.js";

export default class WorkersRegistry extends EventEmitter {
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
        await Promise.promisify(workerFarm.end)(this._workerFarm);
    }

    isEnded() {
        return this._ended;
    }

    register(workerFilepath, exportedMethods) {
        const workers = new EventEmitter();
        this._registeredWorkers.push(workers);

        for (const methodName of exportedMethods) {
            workers[methodName] = (...args) => {
                if (this._ended) {
                    return Promise.reject(new Error(`Can't execute method '${methodName}' because worker farm ended.`));
                }
                return Promise.promisify(this._workerFarm)(workerFilepath, methodName, args);
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

        return workerFarm(params, workerFilepath);
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
            logger.error(`hermione:worker:${child.pid} terminated unexpectedly with ${errMsg}`);
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
                        this.emit(MasterEvents.ERROR, data.error);
                    }
                    break;
                default:
                    if (data.event) {
                        this._registeredWorkers.forEach(workers => workers.emit(data.event, _.omit(data, "event")));
                    }
                    break;
            }
        });

        this.emit(MasterEvents.NEW_WORKER_PROCESS, WorkerProcess.create(child));
    }
}
