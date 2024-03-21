import crypto from "node:crypto";
import URI from "urijs";
import P from "bluebird";
import _ from "lodash";
import { io } from "socket.io-client";

import NodejsEnvTestRunner from "../../../runner/test-runner";
import { wrapExecutionThread } from "./execution-thread";
import { WorkerEventNames } from "./types";
import { WORKER_EVENT_SUFFIX } from "./constants";
import logger from "../../../../utils/logger";

import { BrowserEventNames } from "../../../../runner/browser-env/vite/types";
import type { WorkerTestRunnerRunOpts, WorkerTestRunnerCtorOpts } from "../../../runner/test-runner/types";
import type { WorkerRunTestResult } from "../../../testplane";
import type { BrowserHistory } from "../../../../types";
import type { Browser } from "../../../../browser/types";
import type { WorkerViteSocket } from "./types";

export class TestRunner extends NodejsEnvTestRunner {
    private _socket: WorkerViteSocket;
    private _runUuid: string = crypto.randomUUID();

    constructor(opts: WorkerTestRunnerCtorOpts) {
        super(opts);

        this._socket = io(this._config.baseUrl, {
            transports: ["websocket"],
            auth: {
                runUuid: this._runUuid,
                type: WORKER_EVENT_SUFFIX,
            },
        }) as WorkerViteSocket;

        this._socket.on("connect_error", err => {
            if (!this._socket.active) {
                logger.warn(
                    `Worker with pid=${process.pid} and runUuid=${this._runUuid} was disconnected from the Vite server:`,
                    err,
                );
            }
        });
    }

    async run(opts: WorkerTestRunnerRunOpts): Promise<WorkerRunTestResult> {
        this._socket.emit(WorkerEventNames.initialize, { file: this._file });
        const results = await super.run({ ...opts, ExecutionThreadCls: wrapExecutionThread(this._socket) });
        this._socket.emit(WorkerEventNames.finalize);

        return results;
    }

    _getPreparePageActions(browser: Browser, history: BrowserHistory): (() => Promise<void>)[] {
        return [
            async (): Promise<void> => {
                await history.runGroup(browser.callstackHistory, "openVite", async () => {
                    await this._openViteUrl(browser);
                });
            },
            ...super._getPreparePageActions(browser, history),
        ];
    }

    private async _openViteUrl(browser: Browser): Promise<void> {
        const browserInitialize = new P((resolve, reject) => {
            this._socket.once(BrowserEventNames.initialize, errors => {
                _.isEmpty(errors) ? resolve() : reject(errors[0]);
            });
        });

        const timeout = this._config.urlHttpTimeout || this._config.httpTimeout;
        const uri = new URI(this._config.baseUrl).query({ runUuid: this._runUuid }).toString();

        await Promise.all([
            browserInitialize.timeout(timeout, `Browser didn't connect to the Vite server in ${timeout}ms`),
            browser.publicAPI.url(uri),
        ]);
    }
}
