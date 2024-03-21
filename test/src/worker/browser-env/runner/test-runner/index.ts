import process from "node:process";
import crypto from "node:crypto";
import { EventEmitter } from "node:stream";
import _ from "lodash";
import P from "bluebird";
import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

import NodejsEnvRunner from "../../../../../../src/worker/runner/test-runner";
import { TestRunner as BrowserEnvRunner } from "../../../../../../src/worker/browser-env/runner/test-runner";
import { WORKER_EVENT_SUFFIX } from "../../../../../../src/worker/browser-env/runner/test-runner/constants";
import { makeBrowserConfigStub } from "../../../../../utils";
import { Test, Suite } from "../../../../../../src/test-reader/test-object";
import BrowserAgent from "../../../../../../src/worker/runner/browser-agent";
import history from "../../../../../../src/browser/history";
import logger from "../../../../../../src/utils/logger";
import OneTimeScreenshooter from "../../../../../../src/worker/runner/test-runner/one-time-screenshooter";

import { BrowserEventNames } from "../../../../../../src/runner/browser-env/vite/types";
import { BrowserViteSocket } from "../../../../../../src/runner/browser-env/vite/browser-modules/types";
import {
    WorkerEventNames,
    type WorkerViteSocket,
} from "../../../../../../src/worker/browser-env/runner/test-runner/types";
import type { Socket } from "socket.io-client";
import type {
    WorkerTestRunnerRunOpts,
    WorkerTestRunnerCtorOpts,
} from "../../../../../../src/worker/runner/test-runner/types";
import type { Browser } from "../../../../../../src/browser/types";
import type { Test as TestType } from "../../../../../../src/test-reader/test-object/test";
import type { BrowserConfig } from "../../../../../../src/config/browser-config";
import type { WorkerRunTestResult } from "../../../../../../src/worker/testplane";

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
    let BrowserEnvRunnerStub: typeof BrowserEnvRunner;
    let socketClientStub: SinonStub;

    const mkTest_ = (opts?: Partial<TestOpts>): TestType => {
        const test = Test.create({
            ...opts,
            title: "default",
            file: "/default/file/path",
            id: "12345",
            fn: sinon.stub(),
        }) as TestType;
        test.parent = Suite.create();

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
            ..._.omit(opts, "runner"),
        };

        return runner.run(opts as WorkerTestRunnerRunOpts);
    };

    const runWithEmitBrowserInit = async (
        socket: BrowserViteSocket,
        opts: Partial<RunOpts> = {},
    ): Promise<WorkerRunTestResult> => {
        const promise = run_(opts);
        await P.delay(10);
        socket.emit(BrowserEventNames.initialize, []);

        return promise;
    };

    const mkBrowser_ = (): Browser => ({
        publicAPI: {
            url: sandbox.stub().resolves(),
        } as unknown as Browser["publicAPI"],
        config: makeBrowserConfigStub({ saveHistoryMode: "none" }) as BrowserConfig,
        state: {
            isBroken: false,
        },
        applyState: sandbox.stub(),
        callstackHistory: {
            enter: sandbox.stub(),
            leave: sandbox.stub(),
            markError: sandbox.stub(),
            release: sandbox.stub(),
        } as unknown as Browser["callstackHistory"],
    });

    const mkSocket_ = (): WorkerViteSocket => {
        const socket = new EventEmitter() as unknown as WorkerViteSocket;
        socket.emitWithAck = sandbox.stub().resolves([null]);
        socket.timeout = sandbox.stub().returnsThis();

        sinon.spy(socket, "on");
        sinon.spy(socket, "emit");

        return socket;
    };

    beforeEach(() => {
        sandbox.stub(BrowserAgent.prototype, "getBrowser").resolves(mkBrowser_());
        sandbox.stub(BrowserAgent.prototype, "freeBrowser");

        sandbox.stub(OneTimeScreenshooter, "create").returns(Object.create(OneTimeScreenshooter.prototype));
        sandbox.stub(OneTimeScreenshooter.prototype, "extendWithScreenshot").resolves();

        sandbox.stub(crypto, "randomUUID").returns("00000");
        sandbox.stub(process, "pid").value(11111);
        sandbox.stub(logger, "warn");

        socketClientStub = sandbox.stub().returns(mkSocket_());

        ({ TestRunner: BrowserEnvRunnerStub } = proxyquire(
            "../../../../../../src/worker/browser-env/runner/test-runner",
            {
                "socket.io-client": { io: socketClientStub },
            },
        ));
    });

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        describe("socket", () => {
            it("should connect to the baseUrl", () => {
                const baseUrl = "http://localhost:3333";
                const config = makeBrowserConfigStub({ baseUrl }) as BrowserConfig;

                mkRunner_({ config });

                assert.calledOnceWith(socketClientStub, baseUrl);
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
                    sinon.match({ auth: { type: WORKER_EVENT_SUFFIX } }),
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
                    logger.warn,
                    "Worker with pid=77777 and runUuid=12345 was disconnected from the Vite server:",
                    error,
                );
            });
        });
    });

    describe("run", () => {
        beforeEach(() => {
            sandbox.spy(history, "runGroup");
        });

        it(`should emit "${WorkerEventNames.initialize}" event before run test`, async () => {
            sandbox.stub(NodejsEnvRunner.prototype, "run").resolves();

            const file = "/some/file";
            const socket = mkSocket_();
            socketClientStub.returns(socket);
            const runner = mkRunner_({ file });

            await runWithEmitBrowserInit(socket, { runner });

            assert.callOrder(
                (socket.emit as SinonStub).withArgs(WorkerEventNames.initialize, { file }),
                NodejsEnvRunner.prototype.run as SinonStub,
            );
        });

        it(`should emit "${WorkerEventNames.finalize}" event after run test`, async () => {
            sandbox.stub(NodejsEnvRunner.prototype, "run").resolves();

            const socket = mkSocket_();
            socketClientStub.returns(socket);

            await runWithEmitBrowserInit(socket);

            assert.callOrder(
                NodejsEnvRunner.prototype.run as SinonStub,
                (socket.emit as SinonStub).withArgs(WorkerEventNames.finalize),
            );
        });

        it('should log "openVite" in history', async () => {
            const browser = mkBrowser_();
            (BrowserAgent.prototype.getBrowser as SinonStub).resolves(browser);
            const socket = mkSocket_();
            socketClientStub.returns(socket);

            await runWithEmitBrowserInit(socket);

            assert.calledWith(history.runGroup as SinonStub, browser.callstackHistory, "openVite", sinon.match.func);
        });

        it('should open vite server url with "runUuid" query', async () => {
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

            assert.calledOnceWith(browser.publicAPI.url, `http://localhost:4444/?runUuid=${runUuid}`);
        });

        it("should throw error if browser initialization was failed", async () => {
            const socket = mkSocket_() as BrowserViteSocket;
            socketClientStub.returns(socket);
            const error = new Error("o.O");

            const promise = run_();
            await P.delay(10);
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
