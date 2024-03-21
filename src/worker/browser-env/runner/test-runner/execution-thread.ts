import NodejsEnvExecutionThread from "../../../runner/test-runner/execution-thread";
import { SOCKET_MAX_TIMEOUT, SOCKET_TIMED_OUT_ERROR } from "../../../../runner/browser-env/vite/constants";

import { WorkerEventNames } from "./types";
import type { WorkerViteSocket } from "./types";
import type { ExecutionThreadCtorOpts } from "../../../runner/test-runner/types";
import type { Test } from "../../../../test-reader/test-object/test";
import type { Hook } from "../../../../test-reader/test-object/hook";

export const wrapExecutionThread = (socket: WorkerViteSocket): typeof NodejsEnvExecutionThread => {
    return class ExecutionThread extends NodejsEnvExecutionThread {
        private _socket = socket;

        constructor(opts: ExecutionThreadCtorOpts & { runUuid: string }) {
            super(opts);
        }

        async _call(runnable: Test | Hook): Promise<void> {
            runnable.fn = async (): Promise<void> => {
                const timeout = runnable.timeout === 0 ? SOCKET_MAX_TIMEOUT : runnable.timeout;

                try {
                    const [error] = (await this._socket
                        .timeout(timeout)
                        .emitWithAck(WorkerEventNames.runRunnable, { fullTitle: runnable.fullTitle() })) as [
                        null | Error,
                    ];

                    if (error) {
                        throw error;
                    }
                } catch (err) {
                    let error = err as Error;

                    if (error.message === SOCKET_TIMED_OUT_ERROR) {
                        error = new Error(
                            `Didn't receive response from browser on "${WorkerEventNames.runRunnable}" when executing ${runnable.fullTitle} event in ${timeout}ms`,
                        );
                    }

                    throw error;
                }
            };

            return super._call(runnable);
        }
    };
};
