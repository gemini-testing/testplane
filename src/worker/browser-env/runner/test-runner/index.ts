import crypto from "node:crypto";
import URI from "urijs";
import _ from "lodash";
import NodejsEnvTestRunner from "../../../runner/test-runner";
import RuntimeConfig from "../../../../config/runtime-config";
import { wrapExecutionThread } from "./execution-thread";
import { WorkerEventNames } from "../../types";

import { BrowserEventNames, BrowserPayload, BrowserPayloadByEvent } from "../../../../runner/browser-env/vite/types";
import type { ViteWorkerCommunicator } from "../../communicator";
import type { WorkerTestRunnerRunOpts, WorkerTestRunnerCtorOpts } from "../../../runner/test-runner/types";
import type { WorkerRunTestResult } from "../../../hermione";
import type { BrowserHistory } from "../../../../types";
import type { Browser } from "../../../../browser/types";
import type { BrowserEnvRuntimeConfig } from "../../types";

export class TestRunner extends NodejsEnvTestRunner {
    #communicator: ViteWorkerCommunicator;
    #runUuid: string = crypto.randomUUID();
    #runOpts!: WorkerTestRunnerRunOpts;

    constructor(opts: WorkerTestRunnerCtorOpts) {
        super(opts);

        this.#communicator = (RuntimeConfig.getInstance() as BrowserEnvRuntimeConfig).viteWorkerCommunicator;
    }

    async run(opts: WorkerTestRunnerRunOpts): Promise<WorkerRunTestResult> {
        this.#runOpts = opts;

        // TODO: send sessionEnd event and remove all listeners
        return super.run({ ...opts, ExecutionThreadCls: wrapExecutionThread(this.#runUuid) });
    }

    _getPreparePageActions(browser: Browser, history: BrowserHistory): (() => Promise<void>)[] {
        return [
            async (): Promise<void> => {
                await history.runGroup(browser.callstackHistory, "openVite", async () => {
                    const { publicAPI: session } = browser;
                    const cmdUuid = crypto.randomUUID();

                    console.log('browser.customCommands:', browser.customCommands);

                    // TODO: move to separate method
                    this.#communicator.sendMessage({ event: WorkerEventNames.init, data: {
                        pid: process.pid,
                        runUuid: this.#runUuid,
                        cmdUuid,
                        sessionId: this.#runOpts.sessionId,
                        capabilities: this.#runOpts.sessionCaps as WebdriverIO.Capabilities,
                        requestedCapabilities: this.#runOpts.sessionOpts.capabilities as WebdriverIO.Capabilities,
                        customCommands: browser.customCommands,
                        file: this._file,
                    }});

                    this.#communicator.addListenerByRunUuid(this.#runUuid, async (msg) => {
                        if (!(isBrowserRunCommandMsg(msg))) {
                            return;
                        }

                        // TODO: handle outside this function - _getPreparePageActions
                        const {cmdUuid, command} = msg.data;

                        if (typeof session[command.name as keyof typeof session] !== 'function') {
                            this.#communicator.sendMessage({
                                event: WorkerEventNames.commandResult,
                                data: {
                                    pid: process.pid,
                                    runUuid: this.#runUuid,
                                    cmdUuid: cmdUuid,
                                    error: new Error(`browser.${command.name} does not exists in browser instance`)
                                },
                            });

                            return;
                        }

                        try {
                            const result = await (session[command.name as keyof typeof session] as Function)(...command.args);
                            console.log('BROWSER result:', result);

                            this.#communicator.sendMessage({
                                event: WorkerEventNames.commandResult,
                                data: {
                                    pid: process.pid,
                                    runUuid: this.#runUuid,
                                    cmdUuid: cmdUuid,
                                    result
                                },
                            });
                        } catch (error) {
                            console.log('BROWSER error:', error);

                            this.#communicator.sendMessage({
                                event: WorkerEventNames.commandResult,
                                data: {
                                    pid: process.pid,
                                    runUuid: this.#runUuid,
                                    cmdUuid: cmdUuid,
                                    error: error as Error
                                },
                            });
                        }
                    });

                    const uri = new URI(this._config.baseUrl)
                        .query({
                            // pid: process.pid,
                            // file: this._file,
                            runUuid: this.#runUuid,
                            // cmdUuid,
                        })
                        .toString();
                    await session.url(uri);

                    const msg = await this.#communicator.waitMessage<BrowserEventNames.init>({
                        cmdUuid,
                        timeout: this._config.urlHttpTimeout || this._config.httpTimeout,
                    });

                    if (!_.isEmpty(msg.data.errors)) {
                        throw msg.data.errors[0];
                    }
                });
            },
            ...super._getPreparePageActions(browser, history),
        ];
    }
}

// TODO: move helpers like this to some utils file
const isBrowserRunCommandMsg = (msg: BrowserPayload): msg is BrowserPayloadByEvent<BrowserEventNames.runCommand> => {
    return msg.event === BrowserEventNames.runCommand;
};
