import repl, { type REPLServer } from "node:repl";
import { EventEmitter } from "node:events";
import * as webdriverio from "webdriverio";
import chalk from "chalk";
import sinon, { type SinonStub, type SinonSpy } from "sinon";

import RuntimeConfig from "src/config/runtime-config";
import clientBridge from "src/browser/client-bridge";
import logger from "src/utils/logger";
import { mkExistingBrowser_ as mkBrowser_, mkSessionStub_ } from "../utils";

import type ExistingBrowser from "src/browser/existing-browser";

describe('"switchToRepl" command', () => {
    const sandbox = sinon.createSandbox();

    const initBrowser_ = ({ browser = mkBrowser_(), session = mkSessionStub_() } = {}): Promise<ExistingBrowser> => {
        (webdriverio.attach as SinonStub).resolves(session);

        return browser.init({ sessionId: session.sessionId, sessionCaps: session.capabilities, sessionOpts: {} });
    };

    const mkReplServer_ = (): REPLServer => {
        const replServer = new EventEmitter() as REPLServer;
        (replServer.context as unknown) = {};

        sandbox.stub(repl, "start").returns(replServer);

        return replServer;
    };

    const switchToRepl_ = async ({
        session = mkSessionStub_(),
        replServer = mkReplServer_(),
        ctx = {},
    }): Promise<void> => {
        const promise = session.switchToRepl(ctx);

        replServer.emit("exit");
        await promise;
    };

    beforeEach(() => {
        sandbox.stub(webdriverio, "attach");
        sandbox.stub(clientBridge, "build").resolves();
        sandbox.stub(RuntimeConfig, "getInstance").returns({ replMode: { enabled: false }, extend: sinon.stub() });
        sandbox.stub(logger, "warn");
        sandbox.stub(logger, "log");
        sandbox.stub(process, "chdir");
    });

    afterEach(() => sandbox.restore());

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
            (RuntimeConfig.getInstance as SinonStub).returns({ replMode: { enabled: true }, extend: sinon.stub() });
        });

        it("should inform that user entered to repl server before run it", async () => {
            const session = mkSessionStub_();

            await initBrowser_({ session });
            await switchToRepl_({ session });

            assert.callOrder(
                (logger.log as SinonStub).withArgs(
                    chalk.yellow("You have entered to REPL mode via terminal (test execution timeout is disabled)."),
                ),
                repl.start as SinonStub,
            );
        });

        it("should change cwd to test directory before run repl server", async () => {
            const session = mkSessionStub_();
            session.executionContext.ctx.currentTest.file = "/root/project/dir/file.testplane.js";

            await initBrowser_({ session });
            await switchToRepl_({ session });

            assert.callOrder((process.chdir as SinonStub).withArgs("/root/project/dir"), repl.start as SinonStub);
        });

        it("should change cwd to its original value on close repl server", async () => {
            const session = mkSessionStub_();
            session.executionContext.ctx.currentTest.file = "/root/project/dir/file.testplane.js";
            const currCwd = process.cwd();
            const onExit = sandbox.spy();

            const replServer = mkReplServer_();
            replServer.on("exit", onExit);

            await initBrowser_({ session });
            const promise = session.switchToRepl();

            replServer.emit("exit");
            await promise;

            assert.callOrder(onExit, (process.chdir as SinonStub).withArgs(currCwd));
        });

        it("should extend runtime config by instance of repl server", async () => {
            const runtimeCfg = { replMode: { enabled: true }, extend: sinon.stub() };
            (RuntimeConfig.getInstance as SinonStub).returns(runtimeCfg);

            const replServer = mkReplServer_();
            const session = mkSessionStub_();

            await initBrowser_({ session });
            await switchToRepl_({ session, replServer });

            assert.calledOnceWith(runtimeCfg.extend, { replServer });
        });

        it("should add browser instance to repl context by default", async () => {
            const session = mkSessionStub_();
            const replServer = mkReplServer_();

            await initBrowser_({ session });
            await switchToRepl_({ session, replServer });

            assert.deepEqual(replServer.context.browser, session);
        });

        it("should not be able to overwrite browser instance in repl context", async () => {
            const session = mkSessionStub_();
            const replServer = mkReplServer_();

            await initBrowser_({ session });
            await switchToRepl_({ session, replServer });

            try {
                replServer.context.browser = "foo";
            } catch (err) {
                assert.match((err as Error).message, "Cannot assign to read only property 'browser'");
            }
        });

        it("should add passed user context to repl server", async () => {
            const session = mkSessionStub_();
            const replServer = mkReplServer_();

            await initBrowser_({ session });
            await switchToRepl_({ session, replServer, ctx: { foo: "bar" } });

            assert.equal(replServer.context.foo, "bar");
        });

        it("should not create new repl server if old one is already used", async () => {
            const replServer = mkReplServer_();
            const session = mkSessionStub_();

            await initBrowser_({ session });
            const promise1 = session.switchToRepl();
            const promise2 = session.switchToRepl();

            replServer.emit("exit");
            await Promise.all([promise1, promise2]);

            assert.calledOnce(repl.start as SinonStub);
            assert.calledOnceWith(logger.warn, chalk.yellow("Testplane is already in REPL mode"));
        });

        ["const", "let"].forEach(decl => {
            describe(`"${decl}" declaration to var in order to reassign`, () => {
                let replServer: REPLServer;
                let onLine: SinonSpy;

                beforeEach(async () => {
                    replServer = mkReplServer_();
                    onLine = sandbox.spy();
                    replServer.on("line", onLine);

                    const session = mkSessionStub_();

                    await initBrowser_({ session });
                    await switchToRepl_({ session, replServer });
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
    });
});
