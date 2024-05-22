import NodejsEnvExecutionThread from "../../../runner/test-runner/execution-thread";
import { SOCKET_MAX_TIMEOUT } from "../../../../runner/browser-env/vite/constants";

import { WorkerEventNames } from "./types";
import type { WorkerViteSocket } from "./types";
import type { ExecutionThreadCtorOpts } from "../../../runner/test-runner/types";
import type { Test } from "../../../../test-reader/test-object/test";
import type { Hook } from "../../../../test-reader/test-object/hook";

const ABORT_INTERVAL = 500;

export const wrapExecutionThread = (
    socket: WorkerViteSocket,
    throwIfAborted: () => void,
): typeof NodejsEnvExecutionThread => {
    return class ExecutionThread extends NodejsEnvExecutionThread {
        private _socket = socket;

        constructor(opts: ExecutionThreadCtorOpts & { runUuid: string }) {
            super(opts);
        }

        async _call(runnable: Test | Hook): Promise<void> {
            runnable.fn = async (): Promise<void> => {
                return new Promise((resolve, reject) => {
                    let intervalId: NodeJS.Timeout | null = null;

                    try {
                        throwIfAborted();

                        intervalId = setInterval(() => {
                            try {
                                throwIfAborted();
                            } catch (err) {
                                if (intervalId) {
                                    clearInterval(intervalId);
                                }

                                return reject(err);
                            }
                        }, ABORT_INTERVAL).unref();
                    } catch (err) {
                        if (intervalId) {
                            clearInterval(intervalId);
                        }

                        return reject(err);
                    }

                    const timeout = runnable.timeout === 0 ? SOCKET_MAX_TIMEOUT : runnable.timeout;

                    return this._socket
                        .timeout(timeout)
                        .emitWithAck(WorkerEventNames.runRunnable, { fullTitle: runnable.fullTitle() })
                        .then(([error]: [null | Error]) => {
                            if (intervalId) {
                                clearInterval(intervalId);
                            }

                            if (error) {
                                return reject(error);
                            } else {
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
