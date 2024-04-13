import crypto from "node:crypto";
import URI from "urijs";
import P from "bluebird";
import _ from "lodash";
import { io } from "socket.io-client";

import NodejsEnvTestRunner from "../../../runner/test-runner";
import { wrapExecutionThread } from "./execution-thread";
import { WorkerEventNames } from "./types";
import { WORKER_EVENT_PREFIX } from "./constants";
import logger from "../../../../utils/logger";

import { BrowserEventNames } from "../../../../runner/browser-env/vite/types";
import type { WorkerTestRunnerRunOpts, WorkerTestRunnerCtorOpts } from "../../../runner/test-runner/types";
import type { BrowserConfig } from "../../../../config/browser-config";
import type { WorkerRunTestResult } from "../../../testplane";
import type { BrowserHistory } from "../../../../types";
import type { Browser } from "../../../../browser/types";
import type { WorkerViteSocket } from "./types";

import type { BrowserViteEvents } from "../../../../runner/browser-env/vite/types";

const prepareData = <T>(data: T): T => {
    return JSON.parse(JSON.stringify(data, Object.getOwnPropertyNames(data)));
};

export class TestRunner extends NodejsEnvTestRunner {
    private _socket: WorkerViteSocket;
    private _runUuid: string = crypto.randomUUID();
    private _runOpts!: WorkerTestRunnerRunOpts;

    constructor(opts: WorkerTestRunnerCtorOpts) {
        super(opts);

        this._socket = io(this._config.baseUrl, {
            transports: ["websocket"],
            auth: {
                runUuid: this._runUuid,
                type: WORKER_EVENT_PREFIX,
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
        this._runOpts = opts;

        const results = await super.run({ ...opts, ExecutionThreadCls: wrapExecutionThread(this._socket) });
        this._socket.emit(WorkerEventNames.finalize);

        return results;
    }

    _getPreparePageActions(browser: Browser, history: BrowserHistory): (() => Promise<void>)[] {
        return [
            async (): Promise<void> => {
                this._socket.on(BrowserEventNames.runBrowserCommand, this._handleRunBrowserCommand(browser));

                this._socket.emit(WorkerEventNames.initialize, {
                    file: this._file,
                    sessionId: this._runOpts.sessionId,
                    capabilities: this._runOpts.sessionCaps,
                    requestedCapabilities: this._runOpts.sessionOpts.capabilities,
                    customCommands: browser.customCommands,
                    config: this._config as BrowserConfig,
                });

                await history.runGroup(browser.callstackHistory, "openVite", async () => {
                    await this._openViteUrl(browser);
                });
            },
            ...super._getPreparePageActions(browser, history),
        ];
    }

    private _handleRunBrowserCommand(browser: Browser): BrowserViteEvents[BrowserEventNames.runBrowserCommand] {
        const { publicAPI: session } = browser;

        return async (payload, cb): Promise<void> => {
            const { name, args } = payload;
            const cmdName = name as keyof typeof session;

            if (typeof session[cmdName] !== "function") {
                cb([prepareData<Error>(new Error(`"browser.${name}" does not exists in browser instance`))]);
                return;
            }

            try {
                const result = await (session[cmdName] as (...args: unknown[]) => Promise<unknown>)(...args);

                if (_.isError(result)) {
                    return cb([prepareData<Error>(result)]);
                }

                if (_.isArray(result)) {
                    return cb([null, result.map(prepareData)]);
                }

                cb([null, _.isObject(result) ? prepareData(result) : result]);
            } catch (err) {
                cb([prepareData<Error>(err as Error)]);
            }
        };
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
