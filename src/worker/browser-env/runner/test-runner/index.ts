import crypto from "node:crypto";
import P from "bluebird";
import _ from "lodash";
import { io } from "socket.io-client";
import urljoin from "url-join";

import NodejsEnvTestRunner from "../../../runner/test-runner";
import { wrapExecutionThread } from "./execution-thread";
import { WorkerEventNames } from "./types";
import { WORKER_EVENT_PREFIX, SUPPORTED_ASYMMETRIC_MATCHER } from "./constants";
import logger from "../../../../utils/logger";
import RuntimeConfig from "../../../../config/runtime-config";

import { BrowserEventNames } from "../../../../runner/browser-env/vite/types";
import type { Selector } from "webdriverio";
import type { AsymmetricMatchers } from "expect";
import type { WorkerTestRunnerRunOpts, WorkerTestRunnerCtorOpts } from "../../../runner/test-runner/types";
import type { BrowserConfig } from "../../../../config/browser-config";
import type { WorkerRunTestResult } from "../../../testplane";
import type { BrowserHistory } from "../../../../types";
import type { Browser } from "../../../../browser/types";
import type { WorkerViteSocket } from "./types";
import type { BrowserViteEvents } from "../../../../runner/browser-env/vite/types";
import type { AsyncExpectationResult } from "../../../../runner/browser-env/vite/browser-modules/types";

type ExpectWdioMatchers = ExpectWebdriverIO.Matchers<AsyncExpectationResult, unknown>;
type ExpectWdioMatcher = (actual: unknown, ...expected: unknown[]) => AsyncExpectationResult;

const prepareData = <T>(data: T): T => {
    return JSON.parse(JSON.stringify(data, Object.getOwnPropertyNames(data)));
};

export class TestRunner extends NodejsEnvTestRunner {
    private _socket: WorkerViteSocket;
    private _runUuid: string = crypto.randomUUID();
    private _runOpts!: WorkerTestRunnerRunOpts;

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

        const results = await super.run({ ...opts, ExecutionThreadCls: wrapExecutionThread(this._socket) });
        this._socket.emit(WorkerEventNames.finalize);

        return results;
    }

    _getPreparePageActions(browser: Browser, history: BrowserHistory): (() => Promise<void>)[] {
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
                    requestedCapabilities: this._runOpts.sessionOpts.capabilities,
                    customCommands: browser.customCommands,
                    config: this._config as BrowserConfig,
                    expectMatchers: Object.getOwnPropertyNames(expectMatchers),
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

    private _handleRunExpectMatcher(
        browser: Browser,
        expectMatchers: ExpectWdioMatchers,
    ): BrowserViteEvents[BrowserEventNames.runExpectMatcher] {
        const { publicAPI: session } = browser;

        return async (payload, cb): Promise<void> => {
            if (!global.expect) {
                return cb([{ pass: false, message: "Couldn't find expect module" }]);
            }

            const matcher = expectMatchers[payload.name as keyof ExpectWdioMatchers] as ExpectWdioMatcher;

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
        const browserInitialize = new P((resolve, reject) => {
            this._socket.once(BrowserEventNames.initialize, errors => {
                _.isEmpty(errors) ? resolve() : reject(errors[0]);
            });
        });

        const timeout = this._config.urlHttpTimeout || this._config.httpTimeout;
        const uri = urljoin(this._config.baseUrl, this._runUuid);

        await Promise.all([
            browserInitialize.timeout(timeout, `Browser didn't connect to the Vite server in ${timeout}ms`),
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
        const matcher: any = arg.inverse ? (global.expect.not as any)[matcherKey] : (global.expect as any)[matcherKey];

        if (!matcher) {
            throw new Error(`Matcher "${matcherKey}" is not supported by expect-webdriverio`);
        }

        return matcher(arg.sample);
    }

    return arg;
}
