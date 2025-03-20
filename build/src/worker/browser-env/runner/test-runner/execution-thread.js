"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapExecutionThread = void 0;
const execution_thread_1 = __importDefault(require("../../../runner/test-runner/execution-thread"));
const constants_1 = require("../../../../runner/browser-env/vite/constants");
const types_1 = require("./types");
const ABORT_INTERVAL = 500;
const wrapExecutionThread = (socket, throwIfAborted) => {
    return class ExecutionThread extends execution_thread_1.default {
        constructor(opts) {
            super(opts);
            this._socket = socket;
        }
        async _call(runnable) {
            runnable.fn = async () => {
                return new Promise((resolve, reject) => {
                    let intervalId = null;
                    try {
                        throwIfAborted();
                        intervalId = setInterval(() => {
                            try {
                                throwIfAborted();
                            }
                            catch (err) {
                                if (intervalId) {
                                    clearInterval(intervalId);
                                }
                                return reject(err);
                            }
                        }, ABORT_INTERVAL).unref();
                    }
                    catch (err) {
                        if (intervalId) {
                            clearInterval(intervalId);
                        }
                        return reject(err);
                    }
                    const timeout = runnable.timeout === 0 ? constants_1.SOCKET_MAX_TIMEOUT : runnable.timeout;
                    return this._socket
                        .timeout(timeout)
                        .emitWithAck(types_1.WorkerEventNames.runRunnable, { fullTitle: runnable.fullTitle() })
                        .then(([error]) => {
                        if (intervalId) {
                            clearInterval(intervalId);
                        }
                        if (error) {
                            return reject(error);
                        }
                        else {
                            return resolve();
                        }
                    })
                        .catch(reject);
                });
            };
            return super._call(runnable);
        }
    };
};
exports.wrapExecutionThread = wrapExecutionThread;
//# sourceMappingURL=execution-thread.js.map