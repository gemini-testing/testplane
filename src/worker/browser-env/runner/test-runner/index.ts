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
// import type { AsymmetricMatchers } from 'expect-webdriverio';
import type { AsymmetricMatchers } from "expect";

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

                    // TODO: move to constructor
                    const {default: expectMatchers} = await import("expect-webdriverio/lib/matchers");

                    console.log('matchers:', expectMatchers);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    console.log('matchers.toHaveTitle:', (expectMatchers as any).toHaveTitle.toString());

                    // TODO: move to separate method
                    this.#communicator.sendMessage({ event: WorkerEventNames.init, data: {
                        pid: process.pid,
                        runUuid: this.#runUuid,
                        cmdUuid,
                        sessionId: this.#runOpts.sessionId,
                        capabilities: this.#runOpts.sessionCaps as WebdriverIO.Capabilities,
                        requestedCapabilities: this.#runOpts.sessionOpts.capabilities as WebdriverIO.Capabilities,
                        customCommands: browser.customCommands,
                        expectMatchers: global.expect ? Object.getOwnPropertyNames(global.expect) : [],
                        file: this._file,
                    }});

                    this.#communicator.addListenerByRunUuid(this.#runUuid, async (msg) => {
                        if (isBrowserRunExpectMatcherMsg(msg)) {
                            const {cmdUuid, matcher} = msg.data;

                            if (!global.expect) {
                                const message = `Couldn't find expect module`;
                                return this.#communicator.sendMessage({
                                    event: WorkerEventNames.expectMatcherResult,
                                    data: {
                                        pid: process.pid,
                                        runUuid: this.#runUuid,
                                        cmdUuid: cmdUuid,
                                        pass: false,
                                        message,
                                    },
                                });
                            }

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const expectMatcher = (expectMatchers as any)[matcher.name];
                            // console.log('expectMatcher:', expectMatcher.toString());
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            // console.log('TO HAVE TITLE:', (global.expect as any).toHaveTitle.toString());

                            if (!expectMatcher) {
                                const message = `Couldn't find matcher with name "${matcher.name}"`
                                return this.#communicator.sendMessage({
                                    event: WorkerEventNames.expectMatcherResult,
                                    data: {
                                        pid: process.pid,
                                        runUuid: this.#runUuid,
                                        cmdUuid: cmdUuid,
                                        pass: false,
                                        message,
                                    },
                                });
                            }

                            try {
                                const context = matcher.element
                                    ? Array.isArray(matcher.element)
                                        ? await session.$$(matcher.element)
                                        /**
                                         * check if element contains an `elementId` property, if so the element was already
                                         * found, so we can transform it into an `WebdriverIO.Element` object, if not we
                                         * need to find it first, so we pass in the selector.
                                         */
                                        : matcher.element.elementId
                                            ? await session.$(matcher.element)
                                            : await session.$(matcher.element.selector)
                                    : matcher.context || session;

                                console.log('matcher:', matcher);

                                const result = await expectMatcher.apply(matcher.scope, [context, ...matcher.args.map(transformExpectArgs)]);
                                // const result = await expectMatcher.apply(matcher.scope, [context]).asymmetricMatch(...matcher.args.map(transformExpectArgs));
                                // const result = await expectMatcher.apply(matcher.scope, [context, ...matcher.args])

                                console.log('result:', result);
                                console.log('result names:', Object.getOwnPropertyNames(result));

                                return this.#communicator.sendMessage({
                                    event: WorkerEventNames.expectMatcherResult,
                                    data: {
                                        pid: process.pid,
                                        runUuid: this.#runUuid,
                                        cmdUuid: cmdUuid,
                                        pass: result.pass,
                                        message: result.message()
                                    },
                                });
                            } catch (err) {
                                const errorMessage = err instanceof Error ? (err as Error).stack : err
                                const message = `Failed to execute expect command "${matcher.name}": ${errorMessage}`

                                return this.#communicator.sendMessage({
                                    event: WorkerEventNames.expectMatcherResult,
                                    data: {
                                        pid: process.pid,
                                        runUuid: this.#runUuid,
                                        cmdUuid: cmdUuid,
                                        pass: false,
                                        message,
                                    },
                                });
                            }

                            return;
                        }

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
function isBrowserRunCommandMsg(msg: BrowserPayload): msg is BrowserPayloadByEvent<BrowserEventNames.runCommand> {
    return msg.event === BrowserEventNames.runCommand;
};

function isBrowserRunExpectMatcherMsg(msg: BrowserPayload): msg is BrowserPayloadByEvent<BrowserEventNames.runExpectMatcher> {
    return msg.event === BrowserEventNames.runExpectMatcher;
};

const SUPPORTED_ASYMMETRIC_MATCHER = {
    Any: 'any',
    Anything: 'anything',
    ArrayContaining: 'arrayContaining',
    ObjectContaining: 'objectContaining',
    StringContaining: 'stringContaining',
    StringMatching: 'stringMatching',
    CloseTo: 'closeTo'
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type
function transformExpectArgs(arg: any) {
    if (typeof arg === 'object' && '$$typeof' in arg && Object.keys(SUPPORTED_ASYMMETRIC_MATCHER).includes(arg.$$typeof)) {
        const matcherKey = SUPPORTED_ASYMMETRIC_MATCHER[arg.$$typeof as keyof typeof SUPPORTED_ASYMMETRIC_MATCHER] as keyof AsymmetricMatchers;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matcher: any = arg.inverse ? (global.expect.not as any)[matcherKey] : (global.expect as any)[matcherKey]

        if (!matcher) {
            throw new Error(`Matcher "${matcherKey}" is not supported by expect-webdriverio`);
        }

        return matcher(arg.sample)
    }

    return arg
}
