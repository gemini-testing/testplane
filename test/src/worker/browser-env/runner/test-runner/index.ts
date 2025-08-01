import process from "node:process";
import crypto from "node:crypto";
import { EventEmitter } from "node:stream";
import _ from "lodash";
import sinon, { SinonStub, SinonFakeTimers } from "sinon";
import proxyquire from "proxyquire";

import type NodejsEnvRunnerOriginal from "../../../../../../src/worker/runner/test-runner";
import { TestRunner as BrowserEnvRunner } from "../../../../../../src/worker/browser-env/runner/test-runner";
import { wrapExecutionThread } from "../../../../../../src/worker/browser-env/runner/test-runner/execution-thread";
import {
    WORKER_EVENT_PREFIX,
    BRO_INIT_TIMEOUT_ON_RECONNECT,
    BRO_INIT_INTERVAL_ON_RECONNECT,
} from "../../../../../../src/worker/browser-env/runner/test-runner/constants";
import { VITE_RUN_UUID_ROUTE } from "../../../../../../src/runner/browser-env/vite/constants";
import { makeBrowserConfigStub } from "../../../../../utils";
import { Test, Suite } from "../../../../../../src/test-reader/test-object";
import { BrowserAgent } from "../../../../../../src/worker/runner/browser-agent";
import * as history from "../../../../../../src/browser/history";
import OneTimeScreenshooter from "../../../../../../src/worker/runner/test-runner/one-time-screenshooter";
import RuntimeConfig from "../../../../../../src/config/runtime-config";

import ExpectWebdriverIO from "expect-webdriverio";
import { BrowserEventNames } from "../../../../../../src/runner/browser-env/vite/types";
import { BrowserViteSocket } from "../../../../../../src/runner/browser-env/vite/browser-modules/types";
import {
    WorkerEventNames,
    type WorkerViteSocket,
} from "../../../../../../src/worker/browser-env/runner/test-runner/types";
import type { Socket } from "socket.io-client";
import type { MatcherState } from "expect";
import type { ChainablePromiseElement } from "@testplane/webdriverio";
import type {
    WorkerTestRunnerRunOpts,
    WorkerTestRunnerCtorOpts,
} from "../../../../../../src/worker/runner/test-runner/types";
import type { Browser } from "../../../../../../src/browser/types";
import type { Test as TestType } from "../../../../../../src/test-reader/test-object/test";
import type { BrowserConfig } from "../../../../../../src/config/browser-config";
import type { WorkerRunTestResult } from "../../../../../../src/worker/testplane";
import { AbortOnReconnectError } from "../../../../../../src/errors/abort-on-reconnect-error";
import { ExistingBrowser } from "../../../../../../src/browser/existing-browser";
import { promiseDelay } from "../../../../../../src/utils/promise";

interface TestOpts {
    title: string;
    file: string;
    id: string;
    fn: VoidFunction;
}
interface RunOpts extends WorkerTestRunnerRunOpts {
    runner?: BrowserEnvRunner;
}

describe("worker/browser-env/runner/test-runner", () => {
    const sandbox = sinon.createSandbox();
    let loggerWarnStub: SinonStub;
    let BrowserEnvRunnerStub: typeof BrowserEnvRunner;
    let socketClientStub: SinonStub;
    let wrapExecutionThreadStub: SinonStub;
    let historyRunGroupStub: SinonStub;
    let NodejsEnvRunner: typeof NodejsEnvRunnerOriginal;

    const mkTest_ = (opts?: Partial<TestOpts>): TestType => {
        const test = Test.create({
            ...opts,
            title: "default",
            file: "/default/file/path",
            id: "12345",
            fn: sinon.stub(),
            location: undefined,
        }) as TestType;
        test.parent = Suite.create({ id: "67890", title: "", file: test.file });

        return test;
    };

    const mkRunnerConfig_ = (opts: Partial<BrowserConfig> = {}): BrowserConfig => {
        return makeBrowserConfigStub({
            baseUrl: "http://localhost:12345",
            system: { patternsOnReject: [] },
            urlHttpTimeout: 1000,
            ...opts,
        }) as BrowserConfig;
    };

    const mkRunner_ = (opts?: Partial<WorkerTestRunnerCtorOpts>): BrowserEnvRunner => {
        opts = {
            test: mkTest_(),
            file: "/default/file/path",
            config: mkRunnerConfig_(),
            browserAgent: Object.create(BrowserAgent.prototype),
            ...opts,
        };

        return BrowserEnvRunnerStub.create(opts as WorkerTestRunnerCtorOpts) as BrowserEnvRunner;
    };

    const run_ = (opts?: Partial<RunOpts>): Promise<WorkerRunTestResult> => {
        const runner = opts?.runner || mkRunner_();

        opts = {
            sessionId: "default-sessionId",
            sessionCaps: {},
            sessionOpts: {} as WorkerTestRunnerRunOpts["sessionOpts"],
            state: {},
            ..._.omit(opts, "runner", "executionContext"),
        };

        return runner.run();
    };

    const runWithEmitBrowserInit = async (
        socket: BrowserViteSocket,
        opts: Partial<RunOpts> = {},
    ): Promise<WorkerRunTestResult> => {
        const promise = run_(opts);
        await promiseDelay(10);
        socket.emit(BrowserEventNames.initialize, []);

        return promise;
    };

    const mkBrowser_ = (opts: Partial<Browser> = {}): ExistingBrowser =>
        ({
            publicAPI: {
                url: sandbox.stub().resolves(),
            } as unknown as Browser["publicAPI"],
            config: makeBrowserConfigStub({ saveHistoryMode: "none" }) as BrowserConfig,
            state: {
                isBroken: false,
            },
            applyState: sandbox.stub(),
            customCommands: [],
            callstackHistory: {
                enter: sandbox.stub(),
                leave: sandbox.stub(),
                markError: sandbox.stub(),
                release: sandbox.stub(),
            } as unknown as Browser["callstackHistory"],
            ...opts,
        } as ExistingBrowser);

    const mkElement_ = (opts: Partial<WebdriverIO.Element> = {}): WebdriverIO.Element => {
        return {
            elementId: "default-id",
            selector: "default-selector",
            ...opts,
        } as unknown as WebdriverIO.Element;
    };

    const mkSocket_ = (): WorkerViteSocket => {
        const socket = new EventEmitter() as unknown as WorkerViteSocket;
        socket.emitWithAck = sandbox.stub().onFirstCall().resolves(null).onSecondCall().resolves([null]);

        socket.timeout = sandbox.stub().returnsThis();

        sinon.spy(socket, "on");
        sinon.spy(socket, "emit");

        return socket;
    };

    const initBrowserEnvRunner_ = (
        opts: { expectMatchers: Record<string, VoidFunction> } = { expectMatchers: {} },
    ): typeof BrowserEnvRunner => {
        loggerWarnStub = sandbox.stub();
        socketClientStub = sandbox.stub().returns(mkSocket_());
        wrapExecutionThreadStub = sandbox
            .stub()
            .callsFake((socket, throwIfAborted) => wrapExecutionThread(socket, throwIfAborted));
        historyRunGroupStub = sandbox.stub().callsFake(history.runGroup);
        NodejsEnvRunner = proxyquire("../../../../../../src/worker/runner/test-runner", {
            "../../../browser/history": {
                runGroup: historyRunGroupStub,
            },
        });

        return proxyquire.noCallThru()("../../../../../../src/worker/browser-env/runner/test-runner", {
            "socket.io-client": { io: socketClientStub },
            "./execution-thread": { wrapExecutionThread: wrapExecutionThreadStub },
            "expect-webdriverio/lib/matchers": opts.expectMatchers,
            "../../../runner/test-runner": NodejsEnvRunner,
            "../../../../utils/logger": {
                warn: loggerWarnStub,
            },
        }).TestRunner;
    };

    beforeEach(() => {
        sandbox.stub(BrowserAgent.prototype, "getBrowser").resolves(mkBrowser_());
        sandbox.stub(BrowserAgent.prototype, "freeBrowser");

        sandbox.stub(OneTimeScreenshooter, "create").returns(Object.create(OneTimeScreenshooter.prototype));
        sandbox.stub(OneTimeScreenshooter.prototype, "extendWithScreenshot").resolves();

        sandbox.stub(crypto, "randomUUID").returns("0-0-0-0-0");
        sandbox.stub(process, "pid").value(11111);

        sandbox.stub(RuntimeConfig, "getInstance").returns({ viteBaseUrl: "http://default" });

        socketClientStub = sandbox.stub().returns(mkSocket_());
        wrapExecutionThreadStub = sandbox
            .stub()
            .callsFake((socket, throwIfAborted) => wrapExecutionThread(socket, throwIfAborted));

        BrowserEnvRunnerStub = initBrowserEnvRunner_();
    });

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        describe("socket", () => {
            it("should connect to the vite baseUrl from runtime config", () => {
                const viteBaseUrl = "http://localhost:3333";
                (RuntimeConfig.getInstance as SinonStub).returns({ viteBaseUrl });

                mkRunner_();

                assert.calledOnceWith(socketClientStub, viteBaseUrl);
            });

            it("should use websocket protocol when connecting", () => {
                mkRunner_();

                assert.calledOnceWith(socketClientStub, sinon.match.any, sinon.match({ transports: ["websocket"] }));
            });

            it('should send uniq "runUuid" parameter when connecting', () => {
                const runUuid = "12345";
                (crypto.randomUUID as SinonStub).returns(runUuid);

                mkRunner_();

                assert.calledOnceWith(socketClientStub, sinon.match.any, sinon.match({ auth: { runUuid } }));
            });

            it('should send "type" parameter when connecting', () => {
                mkRunner_();

                assert.calledOnceWith(
                    socketClientStub,
                    sinon.match.any,
                    sinon.match({ auth: { type: WORKER_EVENT_PREFIX } }),
                );
            });

            it('should subscribe on "connect_error" event', () => {
                const socket = mkSocket_();
                socketClientStub.returns(socket);

                mkRunner_();

                assert.calledOnceWith(socket.on, "connect_error", sinon.match.func);
            });

            it("should inform user if an error occurred while connecting", () => {
                const pid = 77777;
                const runUuid = "12345";
                const error = new Error("o.O");

                sandbox.stub(process, "pid").value(pid);
                (crypto.randomUUID as SinonStub).returns(runUuid);

                const socket = mkSocket_() as Socket;
                (socket as any).active = false;
                socketClientStub.returns(socket);

                mkRunner_();
                socket.emit("connect_error", error);

                assert.calledOnceWith(
                    loggerWarnStub,
                    "Worker with pid=77777 and runUuid=12345 was disconnected from the Vite server:",
                    error,
                );
            });
        });
    });

    describe("run", () => {
        it("should call execution thread wrapper with socket and abort function", async () => {
            const socket = mkSocket_();
            socketClientStub.returns(socket);

            await runWithEmitBrowserInit(socket);

            assert.calledOnceWith(wrapExecutionThreadStub, socket, sinon.match.func);
        });

        it("should call prepare stage to run runnables with correct args", async () => {
            sandbox.stub(NodejsEnvRunner.prototype, "prepareToRun").resolves();
            sandbox.stub(NodejsEnvRunner.prototype, "runRunnables").resolves();
            sandbox.stub(NodejsEnvRunner.prototype, "finishRun").resolves();

            const runOpts = {
                sessionId: "sessionId",
                sessionCaps: {},
                sessionOpts: {},
                state: {},
            } as RunOpts;

            await run_(runOpts);

            assert.calledOnceWith(NodejsEnvRunner.prototype.prepareToRun as SinonStub, runOpts);
        });

        it("should run runnables with execution thread wrapper", async () => {
            sandbox.stub(NodejsEnvRunner.prototype, "runRunnables").resolves();

            let ExecutionThreadCls: unknown;
            wrapExecutionThreadStub.callsFake((socket, throwIfAborted) => {
                ExecutionThreadCls = wrapExecutionThread(socket, throwIfAborted);
                return ExecutionThreadCls;
            });

            await run_({});

            assert.calledOnceWith(NodejsEnvRunner.prototype.runRunnables as SinonStub, ExecutionThreadCls);
        });

        describe(`"${BrowserEventNames.callConsoleMethod}" event`, () => {
            it("should call console method with passed args", async () => {
                sandbox.stub(console, "log");

                const socket = mkSocket_() as BrowserViteSocket;
                socketClientStub.returns(socket);

                await runWithEmitBrowserInit(socket);
                socket.emit(BrowserEventNames.callConsoleMethod, { method: "log", args: ["foo", "bar"] });

                assert.calledOnceWith(console.log, "foo", "bar");
            });
        });

        describe(`"${WorkerEventNames.initialize}" event`, () => {
            it("should emit with correct args", async () => {
                const expectMatchers = { foo: sinon.stub(), bar: sinon.stub() };
                BrowserEnvRunnerStub = initBrowserEnvRunner_({ expectMatchers });

                const socket = mkSocket_();
                socketClientStub.returns(socket);

                const config = mkRunnerConfig_();
                const file = "/some/file";
                const runner = mkRunner_({ file, config });

                const runOpts = {
                    sessionId: "sessionId",
                    sessionCaps: {},
                    sessionOpts: {
                        capabilities: {},
                    },
                    state: {},
                } as RunOpts;

                const customCommands = [{ name: "assertView", elementScope: false }];
                (BrowserAgent.prototype.getBrowser as SinonStub).resolves(mkBrowser_({ customCommands }));

                await runWithEmitBrowserInit(socket, {
                    runner,
                    ...runOpts,
                });

                assert.calledWith(socket.emitWithAck as SinonStub, WorkerEventNames.initialize, {
                    file,
                    sessionId: runOpts.sessionId,
                    capabilities: runOpts.sessionCaps,
                    requestedCapabilities: runOpts.sessionOpts.capabilities,
                    customCommands,
                    config,
                    expectMatchers: ["foo", "bar"],
                });
            });

            it("should throw if master return error", async () => {
                const socket = mkSocket_();
                const err = new Error("o.O");
                (socket.emitWithAck as SinonStub).onFirstCall().resolves(err);
                socketClientStub.returns(socket);

                const runner = mkRunner_({ file: "/some/file" });
                const browser = mkBrowser_();
                (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);

                await assert.isRejected(run_({ runner }), /o.O/);
            });

            it(`should emit before open url`, async () => {
                const socket = mkSocket_();
                socketClientStub.returns(socket);

                const file = "/some/file";
                const runner = mkRunner_({ file });

                const browser = mkBrowser_();
                (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);

                await runWithEmitBrowserInit(socket, { runner });

                assert.callOrder(
                    (socket.emitWithAck as SinonStub).withArgs(WorkerEventNames.initialize, sinon.match.any),
                    browser.publicAPI.url as SinonStub,
                );
            });
        });

        describe(`"${WorkerEventNames.finalize}" event`, () => {
            it(`should emit after completing the test`, async () => {
                sandbox.stub(NodejsEnvRunner.prototype, "finishRun").resolves();

                const socket = mkSocket_();
                socketClientStub.returns(socket);

                await runWithEmitBrowserInit(socket);

                assert.callOrder(
                    NodejsEnvRunner.prototype.finishRun as SinonStub,
                    (socket.emit as SinonStub).withArgs(WorkerEventNames.finalize),
                );
            });
        });

        describe(`"${BrowserEventNames.reconnect}" event`, () => {
            let clock: SinonFakeTimers;

            beforeEach(() => {
                clock = sinon.useFakeTimers({ toFake: ["setInterval", "setTimeout", "clearInterval"] });
            });

            afterEach(() => clock.restore());

            describe("should throw error if", () => {
                it("browser not inited after reconnect", async () => {
                    const socket = mkSocket_() as BrowserViteSocket;
                    socketClientStub.returns(socket);

                    const promise = run_();
                    await clock.tickAsync(1);
                    socket.emit(BrowserEventNames.initialize, []);
                    socket.emit(BrowserEventNames.reconnect);

                    await clock.runToLastAsync();
                    await clock.tickAsync(BRO_INIT_TIMEOUT_ON_RECONNECT);

                    await assert.isRejected(
                        promise,
                        `Browser didn't connect to the Vite server after reconnect in ${BRO_INIT_TIMEOUT_ON_RECONNECT}ms`,
                    );
                });

                it("browser initialization was failed after reconnect", async () => {
                    const socket = mkSocket_() as BrowserViteSocket;
                    socketClientStub.returns(socket);

                    const error = new Error("o.O");

                    const promise = run_();
                    await clock.tickAsync(1);
                    socket.emit(BrowserEventNames.initialize, []);
                    socket.emit(BrowserEventNames.reconnect);
                    socket.emit(BrowserEventNames.initialize, [error]);

                    await clock.runToLastAsync();
                    await clock.tickAsync(BRO_INIT_INTERVAL_ON_RECONNECT);

                    await assert.isRejected(promise, error);
                });

                [
                    { name: "return", sinonMethod: "resolves" as const },
                    { name: "throw", sinonMethod: "rejects" as const },
                ].forEach(({ name, sinonMethod }) => {
                    it(`test ${name} error after reconnect`, async () => {
                        const error = new Error("o.O");

                        sandbox
                            .stub(NodejsEnvRunner.prototype, "runRunnables")
                            .onFirstCall()
                            .resolves(new AbortOnReconnectError())
                            .onSecondCall()
                            [sinonMethod](error);

                        const socket = mkSocket_() as BrowserViteSocket;
                        socketClientStub.returns(socket);

                        const promise = run_();

                        await clock.tickAsync(1);
                        socket.emit(BrowserEventNames.reconnect);
                        socket.emit(BrowserEventNames.initialize, []);

                        await clock.runToLastAsync();

                        await assert.isRejected(promise, error);
                    });
                });
            });

            it("should successfully restart test after reconnect", async () => {
                const socket = mkSocket_() as BrowserViteSocket;
                socketClientStub.returns(socket);

                const promise = run_();
                await clock.tickAsync(1);
                socket.emit(BrowserEventNames.initialize, []);

                await clock.tickAsync(1);
                socket.emit(BrowserEventNames.reconnect);
                socket.emit(BrowserEventNames.initialize, []);

                await clock.runToLastAsync();
                await clock.tickAsync(BRO_INIT_INTERVAL_ON_RECONNECT);

                await assert.isFulfilled(promise);
            });
        });

        describe(`"${BrowserEventNames.runBrowserCommand}" event`, () => {
            describe("call command on element instance", () => {
                describe("should return error as first callback argument if", () => {
                    it("command does not exists", done => {
                        const element = mkElement_();
                        const browser = mkBrowser_();
                        browser.publicAPI.$ = sandbox.stub().resolves(element);

                        (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);
                        const socket = mkSocket_() as BrowserViteSocket;
                        socketClientStub.returns(socket);

                        const expectedErrMsg = '"element.foo" does not exists in element instance';

                        runWithEmitBrowserInit(socket).then(() => {
                            socket.emit(
                                BrowserEventNames.runBrowserCommand,
                                { name: "foo", args: [], element },
                                response => {
                                    try {
                                        assert.match(response, [
                                            { stack: sinon.match(expectedErrMsg), message: expectedErrMsg },
                                        ]);
                                        done();
                                    } catch (err) {
                                        done(err);
                                    }
                                },
                            );
                        });
                    });

                    (
                        [
                            { name: "command return error", cmdStubReturnMethod: "resolves" },
                            { name: "command throw exception", cmdStubReturnMethod: "rejects" },
                        ] as { name: string; cmdStubReturnMethod: "resolves" | "rejects" }[]
                    ).forEach(({ name, cmdStubReturnMethod }) => {
                        it(name, done => {
                            const error = new Error("o.O");

                            const element = mkElement_();
                            element.getCSSProperty = sandbox
                                .stub()
                                [cmdStubReturnMethod as "resolves" | "rejects"](error);

                            const browser = mkBrowser_();
                            browser.publicAPI.$ = sandbox.stub().resolves(element);

                            (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);

                            const socket = mkSocket_() as BrowserViteSocket;
                            socketClientStub.returns(socket);

                            runWithEmitBrowserInit(socket).then(() => {
                                socket.emit(
                                    BrowserEventNames.runBrowserCommand,
                                    { name: "getCSSProperty", args: [], element },
                                    response => {
                                        try {
                                            assert.match(response, [{ message: "o.O", stack: sinon.match("o.O") }]);
                                            done();
                                        } catch (err) {
                                            done(err);
                                        }
                                    },
                                );
                            });
                        });
                    });
                });

                describe("should return result as second callback argument if", () => {
                    it("command executed successfully with string", done => {
                        const result = "some_result";

                        const element = mkElement_();
                        element.getCSSProperty = sandbox.stub().resolves(result);

                        const browser = mkBrowser_();
                        browser.publicAPI.$ = sandbox.stub().resolves(element);

                        (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);

                        const socket = mkSocket_() as BrowserViteSocket;
                        socketClientStub.returns(socket);

                        runWithEmitBrowserInit(socket).then(() => {
                            socket.emit(
                                BrowserEventNames.runBrowserCommand,
                                { name: "getCSSProperty", args: ["foo", "bar"], element },
                                response => {
                                    try {
                                        assert.calledOnceWith(element.getCSSProperty, "foo", "bar");
                                        assert.deepEqual(response, [null, result]);
                                        done();
                                    } catch (err) {
                                        done(err);
                                    }
                                },
                            );
                        });
                    });
                });
            });

            describe("call command on browser instance", () => {
                describe("should return error as first callback argument if", () => {
                    it("command does not exists", done => {
                        const browser = mkBrowser_();
                        (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);
                        const socket = mkSocket_() as BrowserViteSocket;
                        socketClientStub.returns(socket);

                        const expectedErrMsg = '"browser.foo" does not exists in browser instance';

                        runWithEmitBrowserInit(socket).then(() => {
                            socket.emit(BrowserEventNames.runBrowserCommand, { name: "foo", args: [] }, response => {
                                try {
                                    assert.match(response, [
                                        { stack: sinon.match(expectedErrMsg), message: expectedErrMsg },
                                    ]);
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                            });
                        });
                    });

                    (
                        [
                            { name: "command return error", cmdStubReturnMethod: "resolves" },
                            { name: "command throw exception", cmdStubReturnMethod: "rejects" },
                        ] as { name: string; cmdStubReturnMethod: "resolves" | "rejects" }[]
                    ).forEach(({ name, cmdStubReturnMethod }) => {
                        it(name, done => {
                            const error = new Error("o.O");
                            const browser = mkBrowser_();
                            browser.publicAPI.execute = sandbox
                                .stub()
                                [cmdStubReturnMethod as "resolves" | "rejects"](error);
                            (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);

                            const socket = mkSocket_() as BrowserViteSocket;
                            socketClientStub.returns(socket);

                            runWithEmitBrowserInit(socket).then(() => {
                                socket.emit(
                                    BrowserEventNames.runBrowserCommand,
                                    { name: "execute", args: [] },
                                    response => {
                                        try {
                                            assert.match(response, [{ message: "o.O", stack: sinon.match("o.O") }]);
                                            done();
                                        } catch (err) {
                                            done(err);
                                        }
                                    },
                                );
                            });
                        });
                    });
                });

                describe("should return result as second callback argument if", () => {
                    it("command executed successfully with string", done => {
                        const result = "some_result";
                        const browser = mkBrowser_();
                        browser.publicAPI.execute = sandbox.stub().resolves(result);
                        (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);

                        const socket = mkSocket_() as BrowserViteSocket;
                        socketClientStub.returns(socket);

                        runWithEmitBrowserInit(socket).then(() => {
                            socket.emit(
                                BrowserEventNames.runBrowserCommand,
                                { name: "execute", args: [1, 2, 3] },
                                response => {
                                    try {
                                        assert.calledOnceWith(browser.publicAPI.execute, 1, 2, 3);
                                        assert.deepEqual(response, [null, result]);
                                        done();
                                    } catch (err) {
                                        done(err);
                                    }
                                },
                            );
                        });
                    });
                });
            });
        });

        describe(`"${BrowserEventNames.runExpectMatcher}" event`, () => {
            let browser: Browser;

            beforeEach(() => {
                (global as Partial<{ expect: ExpectWebdriverIO.Expect }>).expect =
                    sandbox.stub() as unknown as ExpectWebdriverIO.Expect;

                browser = mkBrowser_();
                (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);
            });

            afterEach(() => {
                delete (global as Partial<{ expect: ExpectWebdriverIO.Expect }>).expect;
            });

            describe("should return error if", () => {
                it("expect module is not found", done => {
                    (global as Partial<{ expect: ExpectWebdriverIO.Expect }>).expect =
                        undefined as unknown as ExpectWebdriverIO.Expect;

                    const socket = mkSocket_() as BrowserViteSocket;
                    socketClientStub.returns(socket);

                    runWithEmitBrowserInit(socket).then(() => {
                        socket.emit(
                            BrowserEventNames.runExpectMatcher,
                            { name: "foo", args: [], scope: {} as MatcherState },
                            response => {
                                try {
                                    assert.deepEqual(response, [
                                        { pass: false, message: "Couldn't find expect module" },
                                    ]);
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                            },
                        );
                    });
                });

                it("expect matcher is not found", done => {
                    const expectMatchers = {};
                    BrowserEnvRunnerStub = initBrowserEnvRunner_({ expectMatchers });

                    const socket = mkSocket_() as BrowserViteSocket;
                    socketClientStub.returns(socket);

                    runWithEmitBrowserInit(socket).then(() => {
                        socket.emit(
                            BrowserEventNames.runExpectMatcher,
                            { name: "foo", args: [], scope: {} as MatcherState },
                            response => {
                                try {
                                    assert.deepEqual(response, [
                                        { pass: false, message: `Couldn't find expect matcher with name "foo"` },
                                    ]);
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                            },
                        );
                    });
                });

                it("expect matcher is failed with exception", done => {
                    const error = new Error("o.O");
                    const expectMatchers = { foo: sinon.stub().throws(error) };
                    BrowserEnvRunnerStub = initBrowserEnvRunner_({ expectMatchers });

                    const socket = mkSocket_() as BrowserViteSocket;
                    socketClientStub.returns(socket);

                    runWithEmitBrowserInit(socket).then(() => {
                        socket.emit(
                            BrowserEventNames.runExpectMatcher,
                            { name: "foo", args: [], scope: {} as MatcherState },
                            response => {
                                try {
                                    assert.deepEqual(response, [
                                        { pass: false, message: `Failed to execute expect command "foo": ${error}` },
                                    ]);
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                            },
                        );
                    });
                });
            });

            describe("should call expect matcher with", () => {
                let expectMatchers: Record<string, SinonStub>;
                let socket: BrowserViteSocket;

                beforeEach(() => {
                    expectMatchers = { matcher: sinon.stub().resolves({ pass: true, message: () => "success" }) };
                    BrowserEnvRunnerStub = initBrowserEnvRunner_({ expectMatchers });

                    socket = mkSocket_() as BrowserViteSocket;
                    socketClientStub.returns(socket);
                });

                it("passed scope as this", done => {
                    const scope = {} as MatcherState;

                    runWithEmitBrowserInit(socket).then(() => {
                        socket.emit(BrowserEventNames.runExpectMatcher, { name: "matcher", args: [], scope }, () => {
                            try {
                                assert.equal(expectMatchers.matcher.firstCall.thisValue, scope);
                                done();
                            } catch (err) {
                                done(err);
                            }
                        });
                    });
                });

                it("context as an browser if element not passed", done => {
                    runWithEmitBrowserInit(socket).then(() => {
                        socket.emit(
                            BrowserEventNames.runExpectMatcher,
                            { name: "matcher", args: [], scope: {} as MatcherState },
                            () => {
                                try {
                                    assert.calledOnceWith(expectMatchers.matcher, browser.publicAPI);
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                            },
                        );
                    });
                });

                it("context as an elements array", done => {
                    const elements = ["elem1", "elem2"] as unknown as ChainablePromiseElement<WebdriverIO.Element>;
                    const elementsRes = ["elem1_res", "elem2_res"];
                    const browser = mkBrowser_();
                    browser.publicAPI.$$ = sandbox.stub().withArgs(elements).resolves(elementsRes);
                    (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);

                    runWithEmitBrowserInit(socket).then(() => {
                        socket.emit(
                            BrowserEventNames.runExpectMatcher,
                            { name: "matcher", args: [], scope: {} as MatcherState, element: elements },
                            () => {
                                try {
                                    assert.calledOnceWith(expectMatchers.matcher, elementsRes);
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                            },
                        );
                    });
                });

                it('context as an element found by "elementId"', done => {
                    const element = { elementId: "123", selector: "body" } as unknown as WebdriverIO.Element;
                    const elementsRes = {};
                    const browser = mkBrowser_();
                    browser.publicAPI.$ = sandbox.stub().withArgs(element).resolves(elementsRes);
                    (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);

                    runWithEmitBrowserInit(socket).then(() => {
                        socket.emit(
                            BrowserEventNames.runExpectMatcher,
                            { name: "matcher", args: [], scope: {} as MatcherState, element },
                            () => {
                                try {
                                    assert.calledOnceWith(expectMatchers.matcher, { ...elementsRes, selector: "body" });
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                            },
                        );
                    });
                });

                it('context as an element found by "selector"', done => {
                    const element = { selector: "body" } as unknown as WebdriverIO.Element;
                    const elementsRes = {};
                    const browser = mkBrowser_();
                    browser.publicAPI.$ = sandbox.stub().withArgs("body").resolves(elementsRes);
                    (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);

                    runWithEmitBrowserInit(socket).then(() => {
                        socket.emit(
                            BrowserEventNames.runExpectMatcher,
                            { name: "matcher", args: [], scope: {} as MatcherState, element },
                            () => {
                                try {
                                    assert.calledOnceWith(expectMatchers.matcher, elementsRes);
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                            },
                        );
                    });
                });

                it("passed args", done => {
                    runWithEmitBrowserInit(socket).then(() => {
                        socket.emit(
                            BrowserEventNames.runExpectMatcher,
                            { name: "matcher", args: ["foo", "bar"], scope: {} as MatcherState },
                            () => {
                                try {
                                    assert.calledOnceWith(expectMatchers.matcher, browser.publicAPI, "foo", "bar");
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                            },
                        );
                    });
                });
            });

            it("should return successfully completed result", done => {
                const expectMatchers = { matcher: sinon.stub().resolves({ pass: true, message: () => "success" }) };
                BrowserEnvRunnerStub = initBrowserEnvRunner_({ expectMatchers });

                const socket = mkSocket_() as BrowserViteSocket;
                socketClientStub.returns(socket);

                runWithEmitBrowserInit(socket).then(() => {
                    socket.emit(
                        BrowserEventNames.runExpectMatcher,
                        { name: "matcher", args: [], scope: {} as MatcherState },
                        response => {
                            try {
                                assert.deepEqual(response, [{ pass: true, message: "success" }]);
                                done();
                            } catch (err) {
                                done(err);
                            }
                        },
                    );
                });
            });
        });

        it('should log "openVite" in history', async () => {
            const browser = mkBrowser_();
            (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);
            const socket = mkSocket_();
            socketClientStub.returns(socket);

            await runWithEmitBrowserInit(socket);

            assert.calledWith(
                historyRunGroupStub as SinonStub,
                { callstack: browser.callstackHistory, config: sinon.match.any, session: sinon.match.any },
                "openVite",
                sinon.match.func,
            );
        });

        it(`should open vite server url with "/${VITE_RUN_UUID_ROUTE}/:uuid" format`, async () => {
            const runUuid = "12345";
            (crypto.randomUUID as SinonStub).returns(runUuid);

            const socket = mkSocket_();
            socketClientStub.returns(socket);

            const browser = mkBrowser_();
            (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);

            const runner = mkRunner_({
                config: makeBrowserConfigStub({
                    baseUrl: "http://localhost:4444",
                    system: { patternsOnReject: [] },
                    urlHttpTimeout: 1000,
                }) as BrowserConfig,
            });

            await runWithEmitBrowserInit(socket, { runner });

            assert.calledOnceWith(browser.publicAPI.url, `http://localhost:4444/${VITE_RUN_UUID_ROUTE}/${runUuid}`);
        });

        it("should throw error if browser initialization was failed", async () => {
            const socket = mkSocket_() as BrowserViteSocket;
            socketClientStub.returns(socket);
            const error = new Error("o.O");

            const promise = run_();
            await promiseDelay(10);
            socket.emit(BrowserEventNames.initialize, [error]);

            await assert.isRejected(promise, error);
        });

        it('should throw error if browser not inited during "httpTimeout"', async () => {
            const httpTimeout = 10;
            const runner = mkRunner_({
                config: mkRunnerConfig_({
                    httpTimeout,
                    urlHttpTimeout: undefined,
                }),
            });

            await assert.isRejected(run_({ runner }), `Browser didn't connect to the Vite server in ${httpTimeout}ms`);
        });

        it('should throw error if browser not inited during "urlHttpTimeout"', async () => {
            const urlHttpTimeout = 20;
            const runner = mkRunner_({
                config: mkRunnerConfig_({
                    httpTimeout: 10,
                    urlHttpTimeout: 20,
                }),
            });

            await assert.isRejected(
                run_({ runner }),
                `Browser didn't connect to the Vite server in ${urlHttpTimeout}ms`,
            );
        });
    });
});
