import crypto from "node:crypto";
import _ from "lodash";
import { io } from "socket.io-client";
import urljoin from "url-join";

import { promiseTimeout } from "../../../../utils/promise";
import NodejsEnvTestRunner from "../../../runner/test-runner";
import { wrapExecutionThread } from "./execution-thread";
import { WorkerEventNames } from "./types";
import {
    WORKER_EVENT_PREFIX,
    SUPPORTED_ASYMMETRIC_MATCHER,
    BRO_INIT_TIMEOUT_ON_RECONNECT,
    BRO_INIT_INTERVAL_ON_RECONNECT,
} from "./constants";
import { VITE_RUN_UUID_ROUTE } from "../../../../runner/browser-env/vite/constants";
import * as logger from "../../../../utils/logger";
import RuntimeConfig from "../../../../config/runtime-config";
import { AbortOnReconnectError } from "../../../../errors/abort-on-reconnect-error";

import { BrowserEventNames } from "../../../../runner/browser-env/vite/types";
import type { Selector, ChainablePromiseElement } from "@testplane/webdriverio";
import type { AsymmetricMatchers } from "expect";
import type { WorkerTestRunnerRunOpts, WorkerTestRunnerCtorOpts } from "../../../runner/test-runner/types";
import type { BrowserConfig } from "../../../../config/browser-config";
import type { WorkerRunTestResult } from "../../../testplane";
import type { BrowserHistory } from "../../../../types";
import type { Browser } from "../../../../browser/types";
import type { WorkerViteSocket } from "./types";
import type { BrowserViteEvents } from "../../../../runner/browser-env/vite/types";
import type { AsyncExpectationResult } from "../../../../runner/browser-env/vite/browser-modules/types";
type ExpectWdioMatchers = ExpectWebdriverIO.Matchers<Promise<void>, unknown>;
type ExpectWdioMatcher = (actual: unknown, ...expected: unknown[]) => AsyncExpectationResult;

const prepareData = <T>(data: T): T => {
    return JSON.parse(JSON.stringify(data, Object.getOwnPropertyNames(data)));
};

export class TestRunner extends NodejsEnvTestRunner {
    private _socket: WorkerViteSocket;
    private _runUuid: string = crypto.randomUUID();
    private _runOpts!: WorkerTestRunnerRunOpts;
    private _isReconnected: boolean = false;
    private _broInitResOnReconnect: Error[] | null = null;

    constructor(opts: WorkerTestRunnerCtorOpts) {
        super(opts);

        this._socket = io(RuntimeConfig.getInstance().viteBaseUrl, {
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
        let error: Error | undefined | null;

        try {
            await super.prepareToRun(this._runOpts);

            error = await this._runWithAbort<Error | undefined>(throwIfAborted => {
                const ExecutionThreadCls = wrapExecutionThread(this._socket, throwIfAborted);

                return super.runRunnables(ExecutionThreadCls) as Promise<Error | undefined>;
            });
        } catch (err) {
            error = err as Error;
        }

        while (error instanceof AbortOnReconnectError) {
            error = null;

            try {
                await this._waitBroInitOnReconnect();

                error = await this._runWithAbort<Error | undefined>(throwIfAborted => {
                    const ExecutionThreadCls = wrapExecutionThread(this._socket, throwIfAborted);

                    return super.runRunnables(ExecutionThreadCls) as Promise<Error | undefined>;
                });
            } catch (err) {
                error = err as Error;
            }
        }

        const results = await super.finishRun(error);
        this._socket.emit(WorkerEventNames.finalize);

        if (error) {
            throw error;
        }

        return results;
    }

    private _runWithAbort<T>(cb: (throwIfAborted: () => void) => Promise<T>): Promise<T> {
        const controller = new AbortController();
        const { signal } = controller;

        let isAborted = signal.aborted;

        signal.addEventListener("abort", () => {
            isAborted = true;
        });

        const throwIfAborted = (): void => {
            if (isAborted) {
                throw new AbortOnReconnectError();
            }
        };

        this._socket.once(BrowserEventNames.reconnect, () => {
            this._broInitResOnReconnect = null;

            this._socket.once(BrowserEventNames.initialize, errors => {
                this._broInitResOnReconnect = errors;
            });

            if (this._browser.state.onReplMode) {
                RuntimeConfig.getInstance().replServer.close();
            }

            this._isReconnected = true;
            controller.abort();
        });

        return cb(throwIfAborted);
    }

    private _waitBroInitOnReconnect(): Promise<void> {
        let intervalId: NodeJS.Timeout | null = null;

        return promiseTimeout(
            new Promise<void>((resolve, reject) => {
                intervalId = setInterval(() => {
                    if (_.isNull(this._broInitResOnReconnect)) {
                        return;
                    }

                    if (intervalId) {
                        clearInterval(intervalId);
                    }

                    if (_.isEmpty(this._broInitResOnReconnect)) {
                        resolve();
                    } else {
                        reject(this._broInitResOnReconnect[0]);
                    }
                }, BRO_INIT_INTERVAL_ON_RECONNECT).unref();
            }),
            BRO_INIT_TIMEOUT_ON_RECONNECT,
            `Browser didn't connect to the Vite server after reconnect in ${BRO_INIT_TIMEOUT_ON_RECONNECT}ms`,
        ).catch(err => {
            if (intervalId) {
                clearInterval(intervalId);
            }

            throw err;
        });
    }

    _getPreparePageActions(browser: Browser, history: BrowserHistory): (() => Promise<void>)[] {
        if (this._isReconnected) {
            return super._getPreparePageActions(browser, history);
        }

        return [
            async (): Promise<void> => {
                const { default: expectMatchers } = await import("expect-webdriverio/lib/matchers");

                this._socket.on(BrowserEventNames.callConsoleMethod, payload => {
                    console[payload.method](...(payload.args || []));
                });

                this._socket.on(BrowserEventNames.runBrowserCommand, this._handleRunBrowserCommand(browser));
                this._socket.on(
                    BrowserEventNames.runExpectMatcher,
                    this._handleRunExpectMatcher(browser, expectMatchers),
                );

                this._socket.emit(WorkerEventNames.initialize, {
                    file: this._file,
                    sessionId: this._runOpts.sessionId,
                    capabilities: this._runOpts.sessionCaps,
                    requestedCapabilities: (
                        this._runOpts.sessionOpts as { capabilities: WebdriverIO.Browser["capabilities"] }
                    ).capabilities,
                    customCommands: browser.customCommands,
                    config: this._config as BrowserConfig,
                    expectMatchers: Object.getOwnPropertyNames(expectMatchers),
                });

                await history.runGroup(
                    {
                        callstack: browser.callstackHistory,
                        session: this._browser.publicAPI,
                        config: this._config,
                    },
                    "openVite",
                    async () => {
                        await this._openViteUrl(browser);
                    },
                );
            },
            ...super._getPreparePageActions(browser, history),
        ];
    }

    private _handleRunBrowserCommand(browser: Browser): BrowserViteEvents[BrowserEventNames.runBrowserCommand] {
        const { publicAPI: session } = browser;

        return async (payload, cb): Promise<void> => {
            const { name, args, element } = payload;

            const wdioInstance = await getWdioInstance(session, element);
            const wdioInstanceName = element ? "element" : "browser";
            const cmdName = name as keyof typeof wdioInstance;

            if (typeof wdioInstance[cmdName] !== "function") {
                cb([
                    prepareData<Error>(
                        new Error(`"${wdioInstanceName}.${name}" does not exists in ${wdioInstanceName} instance`),
                    ),
                ]);
                return;
            }

            try {
                const result = await (wdioInstance[cmdName] as (...args: unknown[]) => Promise<unknown>)(...args);

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

    private _handleRunExpectMatcher(
        browser: Browser,
        expectMatchers: ExpectWdioMatchers,
    ): BrowserViteEvents[BrowserEventNames.runExpectMatcher] {
        const { publicAPI: session } = browser;

        return async (payload, cb): Promise<void> => {
            if (typeof expect === "undefined") {
                return cb([{ pass: false, message: "Couldn't find expect module" }]);
            }

            const matcher = expectMatchers[payload.name as keyof ExpectWdioMatchers] as unknown as ExpectWdioMatcher;

            if (!matcher) {
                return cb([{ pass: false, message: `Couldn't find expect matcher with name "${payload.name}"` }]);
            }

            try {
                let context = payload.context || session;

                if (payload.element) {
                    if (_.isArray(payload.element)) {
                        context = await session.$$(payload.element);
                    } else if (payload.element.elementId) {
                        context = await session.$(payload.element);
                        context.selector = payload.element.selector as Selector;
                    } else {
                        context = await session.$(payload.element.selector as Selector);
                    }
                }

                const result = await matcher.apply(payload.scope, [context, ...payload.args.map(transformExpectArg)]);

                cb([{ pass: result.pass, message: result.message() }]);
            } catch (err) {
                cb([{ pass: false, message: `Failed to execute expect command "${payload.name}": ${err}` }]);
            }
        };
    }

    private async _openViteUrl(browser: Browser): Promise<void> {
        const browserInitialize = new Promise<void>((resolve, reject) => {
            this._socket.once(BrowserEventNames.initialize, errors => {
                _.isEmpty(errors) ? resolve() : reject(errors[0]);
            });
        });

        const timeout = this._config.urlHttpTimeout || this._config.httpTimeout;
        const uri = urljoin(this._config.baseUrl, VITE_RUN_UUID_ROUTE, this._runUuid);

        await Promise.all([
            promiseTimeout(browserInitialize, timeout, `Browser didn't connect to the Vite server in ${timeout}ms`),
            browser.publicAPI.url(uri),
        ]);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformExpectArg(arg: any): unknown {
    if (
        typeof arg === "object" &&
        "$$typeof" in arg &&
        Object.keys(SUPPORTED_ASYMMETRIC_MATCHER).includes(arg.$$typeof)
    ) {
        const matcherKey = SUPPORTED_ASYMMETRIC_MATCHER[
            arg.$$typeof as keyof typeof SUPPORTED_ASYMMETRIC_MATCHER
        ] as keyof AsymmetricMatchers;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matcher: any = arg.inverse ? (expect as any)[matcherKey] : (expect as any)[matcherKey];

        if (!matcher) {
            throw new Error(`Matcher "${matcherKey}" is not supported by expect-webdriverio`);
        }

        return matcher(arg.sample);
    }

    return arg;
}

async function getWdioInstance(
    session: WebdriverIO.Browser,
    element?: WebdriverIO.Element | ChainablePromiseElement<WebdriverIO.Element>,
): Promise<WebdriverIO.Browser | ChainablePromiseElement<WebdriverIO.Element>> {
    const wdioInstance = element ? await session.$(element) : session;

    if (isWdioElement(wdioInstance) && !wdioInstance.selector) {
        wdioInstance.selector = element?.selector as Selector;
    }

    return wdioInstance;
}

function isWdioElement(ctx: WebdriverIO.Browser | WebdriverIO.Element): ctx is WebdriverIO.Element {
    return Boolean((ctx as WebdriverIO.Element).elementId);
}
