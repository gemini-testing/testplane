import { AsyncLocalStorage } from "node:async_hooks";
import repl, { type REPLServer } from "node:repl";
import net from "node:net";
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import proxyquire from "proxyquire";
import chalk from "chalk";
import sinon, { type SinonStub, type SinonSpy } from "sinon";
import { mkExistingBrowser_ as mkBrowser_, mkSessionStub_ } from "../utils";

import RuntimeConfig from "src/config/runtime-config";

import type { ExistingBrowser as ExistingBrowserOriginal } from "src/browser/existing-browser";

describe('"switchToRepl" command', () => {
    const sandbox = sinon.createSandbox();
    const stdinStub = new PassThrough();
    const stdoutStub = new PassThrough();
    const originalStdin = process.stdin;
    const originalStdout = process.stdout;

    let ExistingBrowser: typeof ExistingBrowserOriginal;
    let replStart: SinonStub;
    let logStub: SinonStub;
    let warnStub: SinonStub;
    let webdriverioAttachStub: SinonStub;
    let clientBridgeBuildStub;
    let replServer: REPLServer;
    let netServer: net.Server;
    let netCreateServerCb: (socket: net.Socket) => void;

    const initBrowser_ = ({
        browser = mkBrowser_(undefined, undefined, ExistingBrowser),
        session = mkSessionStub_(),
    } = {}): Promise<ExistingBrowserOriginal> => {
        (webdriverioAttachStub as SinonStub).resolves(session);

        return browser.init(
            { sessionId: session.sessionId, sessionCaps: session.capabilities, sessionOpts: { capabilities: {} } },
            {} as any,
        );
    };

    const mkReplServer_ = (): REPLServer => {
        const replServer = new EventEmitter() as REPLServer;
        (replServer.context as unknown) = {};

        return replServer;
    };

    const mkNetServer_ = (): net.Server => {
        const netServer = new EventEmitter() as net.Server;
        netServer.listen = sandbox.stub().named("listen").returnsThis();
        netServer.close = sandbox.stub().named("close").returnsThis();

        return netServer;
    };

    const mkSocket_ = (): net.Socket => {
        const socket = new EventEmitter() as net.Socket;

        socket.write = sandbox.stub().named("write").returns(true);
        socket.end = sandbox.stub().named("end").returnsThis();

        return socket;
    };

    const waitForReplStart_ = async (): Promise<void> => {
        for (let attempt = 0; attempt < 10 && !replStart.called; attempt++) {
            await new Promise(resolve => setImmediate(resolve));
        }
    };

    const switchToRepl_ = async ({
        session = mkSessionStub_(),
        replServer: server = replServer,
        contexts = [{}],
    }): Promise<void> => {
        replStart.returns(server);
        const promise = session.switchToRepl(...contexts);

        await waitForReplStart_();
        server.emit("exit");
        await promise;
    };

    beforeEach(() => {
        logStub = sandbox.stub();
        warnStub = sandbox.stub();
        replStart = sandbox.stub();
        replServer = mkReplServer_();
        netServer = mkNetServer_();

        replStart = sandbox.stub(repl, "start").returns(replServer);
        sandbox.stub(net, "createServer").callsFake(cb => {
            netCreateServerCb = cb as typeof netCreateServerCb;
            return netServer;
        });
        webdriverioAttachStub = sandbox.stub();
        clientBridgeBuildStub = sandbox.stub().resolves();

        ExistingBrowser = proxyquire("src/browser/existing-browser", {
            "@testplane/webdriverio": {
                attach: webdriverioAttachStub,
            },
            "./client-bridge": {
                build: clientBridgeBuildStub,
            },
            "../utils/logger": { warn: warnStub, log: logStub },
            "./commands/switchToRepl": proxyquire("src/browser/commands/switchToRepl", {
                "../../utils/logger": { warn: warnStub, log: logStub },
            }),
        }).ExistingBrowser;

        sandbox.stub(RuntimeConfig, "getInstance").returns({ replMode: { enabled: false }, extend: sinon.stub() });
        sandbox.stub(process, "chdir");

        Object.defineProperty(process, "stdin", {
            value: stdinStub,
            configurable: true,
        });
        Object.defineProperty(process, "stdout", {
            value: stdoutStub,
            configurable: true,
        });
        sandbox.stub(stdoutStub, "write");
    });

    afterEach(() => {
        sandbox.restore();

        Object.defineProperty(process, "stdin", { value: originalStdin });
        Object.defineProperty(process, "stdout", { value: originalStdout });
    });

    it("should add command", async () => {
        const session = mkSessionStub_();

        await initBrowser_({ session });

        assert.calledWith(session.addCommand, "switchToRepl", sinon.match.func);
    });

    it("should throw error if command is not called in repl mode", async () => {
        const session = mkSessionStub_();

        await initBrowser_({ session });

        try {
            await session.switchToRepl();
        } catch (e) {
            assert.match((e as Error).message, /Command "switchToRepl" available only in REPL mode/);
        }
    });

    describe("in REPL mode", async () => {
        beforeEach(() => {
            (RuntimeConfig.getInstance as SinonStub).returns({
                replMode: { enabled: true, port: 12345 },
                extend: sinon.stub(),
            });
        });

        it("should inform that user entered to repl server before run it", async () => {
            const session = mkSessionStub_();

            await initBrowser_({ session });
            await switchToRepl_({ session });

            assert.calledOnceWith(
                logStub,
                chalk.yellow(
                    "You have entered to REPL mode via terminal (test execution timeout is disabled). Port to connect to REPL from other terminals: 12345",
                ),
            );
            assert.callOrder(logStub as SinonStub, replStart);
        });

        it("should change cwd to test directory before run repl server", async () => {
            const session = mkSessionStub_();
            session.executionContext.ctx.currentTest.file = "/root/project/dir/file.testplane.js";

            await initBrowser_({ session });
            await switchToRepl_({ session });

            assert.callOrder((process.chdir as SinonStub).withArgs("/root/project/dir"), replStart);
        });

        it("should change cwd to its original value on close repl server", async () => {
            const session = mkSessionStub_();
            session.executionContext.ctx.currentTest.file = "/root/project/dir/file.testplane.js";
            const currCwd = process.cwd();
            const onExit = sandbox.spy();

            replServer.on("exit", onExit);

            await initBrowser_({ session });
            const promise = session.switchToRepl();

            await waitForReplStart_();
            replServer.emit("exit");
            await promise;

            assert.callOrder(onExit, (process.chdir as SinonStub).withArgs(currCwd));
        });

        it("should extend runtime config by instance of repl server", async () => {
            const runtimeCfg = { replMode: { enabled: true }, extend: sinon.stub() };
            (RuntimeConfig.getInstance as SinonStub).returns(runtimeCfg);

            const session = mkSessionStub_();

            await initBrowser_({ session });
            await switchToRepl_({ session });

            assert.calledOnceWith(runtimeCfg.extend, { replServer });
        });

        it("should add browser instance to repl context by default", async () => {
            const session = mkSessionStub_();

            await initBrowser_({ session });
            await switchToRepl_({ session });

            assert.deepEqual(replServer.context.browser, session);
        });

        it("should not be able to overwrite browser instance in repl context", async () => {
            const session = mkSessionStub_();

            await initBrowser_({ session });
            await switchToRepl_({ session });

            try {
                replServer.context.browser = "foo";
            } catch (err) {
                assert.match((err as Error).message, "Cannot assign to read only property 'browser'");
            }
        });

        it("should add passed user context to repl server", async () => {
            const session = mkSessionStub_();

            await initBrowser_({ session });
            await switchToRepl_({ session, replServer, contexts: [{ foo: "bar" }] });

            assert.equal(replServer.context.foo, "bar");
        });

        it("should preserve accessor descriptors from passed context", async () => {
            const session = mkSessionStub_();
            const replServer = mkReplServer_();
            const context = {};
            let value = 1;

            Object.defineProperty(context, "foo", {
                enumerable: true,
                get: () => value,
                set: nextValue => {
                    value = nextValue;
                },
            });

            await initBrowser_({ session });
            await switchToRepl_({ session, replServer, contexts: [context] });

            assert.equal(replServer.context.foo, 1);

            value = 2;
            assert.equal(replServer.context.foo, 2);

            replServer.context.foo = 3;
            assert.equal(value, 3);
        });

        it("should not create new repl server if old one is already used", async () => {
            const session = mkSessionStub_();

            await initBrowser_({ session });
            const promise1 = session.switchToRepl();
            await new Promise(resolve => setImmediate(resolve));

            const promise2 = session.switchToRepl();
            await new Promise(resolve => setImmediate(resolve));

            await waitForReplStart_();
            replServer.emit("exit");
            await Promise.all([promise1, promise2]);

            assert.calledOnce(replStart);
            assert.calledOnceWith(warnStub, chalk.yellow("Testplane is already in REPL mode"));
        });

        it("should evaluate commands in the async context in which repl was started", async () => {
            const context = new AsyncLocalStorage<string>();
            const session = mkSessionStub_();
            const onLine = sandbox.spy(() => context.getStore());

            replServer.on("line", onLine);
            await initBrowser_({ session });

            const promise = context.run("test-context", () => session.switchToRepl());

            await waitForReplStart_();
            replServer.emit("line", "getBrowser()");
            replServer.emit("exit");
            await promise;

            assert.calledOnceWith(onLine, "getBrowser()");
            assert.equal(onLine.firstCall.returnValue, "test-context");
        });

        ["const", "let"].forEach(decl => {
            describe(`"${decl}" declaration to var in order to reassign`, () => {
                let onLine: SinonSpy;

                beforeEach(async () => {
                    onLine = sandbox.spy();
                    replServer.on("line", onLine);

                    const session = mkSessionStub_();

                    await initBrowser_({ session });
                    await switchToRepl_({ session });
                    await new Promise(resolve => setImmediate(resolve));
                });

                describe("should modify", () => {
                    it("with spaces before declaration", () => {
                        replServer.emit("line", `   ${decl} foo = 1`);

                        assert.calledWith(onLine.firstCall, "var foo = 1");
                    });

                    it("with few declarations one by one", () => {
                        replServer.emit("line", `${decl} foo = 1; ${decl} bar = 2;${decl} qux = 3`);

                        assert.calledWith(onLine.firstCall, "var foo = 1; var bar = 2;var qux = 3");
                    });

                    it("with declaration in cycle", () => {
                        replServer.emit("line", `for (${decl} item of items) {${decl} a = 1}`);

                        assert.calledWith(onLine.firstCall, "for (var item of items) {var a = 1}");
                    });
                });

                describe("should not modify", () => {
                    it("with declaration as a string", () => {
                        replServer.emit("line", `"${decl} " + '${decl} '`);

                        assert.calledWith(onLine.firstCall, `"${decl} " + '${decl} '`);
                    });

                    it("with declaration as variable name", () => {
                        replServer.emit("line", `var zzz${decl} = 1`);

                        assert.calledWith(onLine.firstCall, `var zzz${decl} = 1`);
                    });
                });
            });
        });

        describe("net server", () => {
            it("should create server with listen port from runtime config", async () => {
                const runtimeCfg = { replMode: { enabled: true, port: 33333 }, extend: sinon.stub() };
                (RuntimeConfig.getInstance as SinonStub).returns(runtimeCfg);

                const session = mkSessionStub_();

                await initBrowser_({ session });
                await switchToRepl_({ session });

                assert.calledOnceWith(netServer.listen, 33333);
            });

            it("should broadcast message from stdin to connected sockets", async () => {
                const socket1 = mkSocket_();
                const socket2 = mkSocket_();
                const session = mkSessionStub_();

                await initBrowser_({ session });
                await switchToRepl_({ session });

                netCreateServerCb(socket1);
                netCreateServerCb(socket2);
                stdinStub.write("o.O");

                assert.calledOnceWith(socket1.write, "o.O");
                assert.calledOnceWith(socket2.write, "o.O");
            });

            it("should broadcast message from socket to other sockets and stdin", async () => {
                const socket1 = mkSocket_();
                const socket2 = mkSocket_();
                const session = mkSessionStub_();

                await initBrowser_({ session });
                await switchToRepl_({ session });

                await new Promise(resolve => setImmediate(resolve));

                netCreateServerCb(socket1);
                netCreateServerCb(socket2);
                socket1.emit("data", Buffer.from("o.O"));

                assert.notCalled(socket1.write as SinonStub);
                assert.calledOnceWith(socket2.write, "o.O");
                assert.calledOnceWith(process.stdout.write, "o.O");
            });

            it("should not broadcast message to closed socket", async () => {
                const socket1 = mkSocket_();
                const socket2 = mkSocket_();
                const session = mkSessionStub_();

                await initBrowser_({ session });
                await switchToRepl_({ session });

                netCreateServerCb(socket1);
                netCreateServerCb(socket2);

                socket1.emit("close");
                stdinStub.write("o.O");

                assert.notCalled(socket1.write as SinonStub);
                assert.calledOnceWith(socket2.write, "o.O");
            });

            it("should close net server on exit from repl", async () => {
                const session = mkSessionStub_();

                await initBrowser_({ session });
                const promise = session.switchToRepl();
                await waitForReplStart_();
                replServer.emit("exit");
                await promise;

                assert.calledOnceWith(netServer.close);
            });

            it("should end sockets on exit from repl", async () => {
                const socket1 = mkSocket_();
                const socket2 = mkSocket_();
                const session = mkSessionStub_();

                await initBrowser_({ session });
                const promise = session.switchToRepl();

                await waitForReplStart_();
                netCreateServerCb(socket1);
                netCreateServerCb(socket2);

                replServer.emit("exit");
                await new Promise(resolve => setImmediate(resolve));
                await promise;

                assert.calledOnceWith(socket1.end, "The server was closed after the REPL was exited");
                assert.calledOnceWith(socket2.end, "The server was closed after the REPL was exited");
            });
        });
    });
});
