import sinon, { type SinonSpy, type SinonStub } from "sinon";
import proxyquire from "proxyquire";
import type { NewBrowser as Browser } from "src/browser/new-browser";
import type { BrowserConfig } from "src/config/browser-config";
import type { BrowserBackendClient } from "src/browser-backend";
import { AsyncEmitter } from "src/events";
import { createBrowserConfig_, mkSessionStub_ } from "./utils";

describe("NewBrowser", () => {
    const sandbox = sinon.createSandbox();
    let NewBrowser: typeof Browser;
    let session: ReturnType<typeof mkSessionStub_>;
    let backend: BrowserBackendClient & {
        startSession: SinonStub;
        deleteSession: SinonStub;
        getDriverPid: SinonStub;
        isCdpAvailable: SinonStub;
    };
    let warn: SinonStub;

    const create = (config: Partial<BrowserConfig> = {}, options = {}): Promise<Browser> =>
        NewBrowser.create(createBrowserConfig_(config).forBrowser(), backend, {
            id: "browser",
            emitter: new AsyncEmitter(),
            ...options,
        });

    beforeEach(() => {
        session = mkSessionStub_();
        backend = {
            startSession: sandbox.stub().resolves(session),
            deleteSession: sandbox.stub().resolves(),
            getDriverPid: sandbox.stub().returns(12345),
            isCdpAvailable: sandbox.stub().returns(true),
        };
        warn = sandbox.stub();
        NewBrowser = proxyquire("src/browser/new-browser", {
            "../utils/logger": { warn },
        }).NewBrowser;
    });

    afterEach(() => sandbox.restore());

    describe("create", () => {
        it("should start a session through the supplied backend", async () => {
            const config = createBrowserConfig_().forBrowser();
            const browser = await NewBrowser.create(config, backend, { id: "browser", emitter: new AsyncEmitter() });

            assert.calledOnceWith(backend.startSession, config, { browserVersionOverride: null });
            assert.strictEqual(browser.publicAPI, session);
            assert.equal(browser.sessionId, session.sessionId);
        });

        it("should pass a version override to the backend", async () => {
            await create({}, { version: "2.0" });

            assert.calledOnceWith(backend.startSession, sinon.match.any, { browserVersionOverride: "2.0" });
        });

        it("should wait for session creation before configuring and returning the browser", async () => {
            let finish!: (session: WebdriverIO.Browser) => void;
            backend.startSession.returns(
                new Promise<WebdriverIO.Browser>(resolve => {
                    finish = resolve;
                }),
            );
            const pending = create();

            assert.notCalled(session.addCommand);
            finish(session);
            const browser = await pending;

            assert.strictEqual(browser.publicAPI, session);
            assert.calledWith(session.addCommand, "extendOptions");
        });

        it("should propagate startup errors without deleting a session that was not acquired", async () => {
            backend.startSession.rejects(new Error("session not created"));

            await assert.isRejected(create(), "session not created");

            assert.notCalled(backend.deleteSession);
        });

        it("should add the extendOptions command", async () => {
            await create();

            session.extendOptions({ newOption: "foo" });

            assert.propertyVal(session.options, "newOption", "foo");
        });

        it("should restore the HTTP timeout after creating the session", async () => {
            await create({ sessionRequestTimeout: 100500, httpTimeout: 500100 });

            assert.propertyVal(session.options, "connectionRetryTimeout", 500100);
            assert.callOrder(backend.startSession, session.extendOptions as SinonSpy);
        });

        it("should leave the page load timeout unchanged when not configured", async () => {
            await create({ pageLoadTimeout: null });

            assert.notCalled(session.setTimeout);
        });

        it("should set the configured page load timeout", async () => {
            await create({ pageLoadTimeout: 100500 });

            assert.calledOnceWith(session.setTimeout, { pageLoad: 100500 });
        });

        [
            { browserName: "chrome", isW3C: false },
            { browserName: "chrome", isW3C: true },
            { browserName: "MicrosoftEdge", isW3C: false },
        ].forEach(({ browserName, isW3C }) => {
            it(`should roll back a failed page load timeout for ${browserName}, W3C=${isW3C}`, async () => {
                session.capabilities = { browserName };
                session.isW3C = isW3C;
                session.setTimeout.rejects(new Error("page load timeout failed"));

                await assert.isRejected(create({ pageLoadTimeout: 100500 }), "page load timeout failed");

                assert.calledOnceWith(backend.deleteSession, session, { force: true });
                assert.notCalled(warn);
            });
        });

        it("should tolerate an unsupported page load timeout in W3C Edge", async () => {
            session.capabilities = { browserName: "MicrosoftEdge" };
            session.isW3C = true;
            session.setTimeout.rejects(new Error("unsupported"));

            await create({ pageLoadTimeout: 100500 });

            assert.calledOnceWith(warn, "WARNING: Can not set page load timeout: unsupported");
            assert.notCalled(backend.deleteSession);
        });

        it("should preserve initialization and rollback errors when both fail", async () => {
            const initializationError = new Error("initialization failed");
            const cleanupError = new Error("cleanup failed");
            session.setTimeout.rejects(initializationError);
            backend.deleteSession.rejects(cleanupError);

            const error = await create({ pageLoadTimeout: 100500 }).catch(error => error);

            assert.strictEqual(error.error, cleanupError);
            assert.strictEqual(error.suppressed, initializationError);
            assert.calledOnceWith(backend.deleteSession, session, { force: true });
        });
    });

    it("should delegate CDP availability and driver PID to the backend", async () => {
        backend.isCdpAvailable.returns(false);
        const browser = await create();

        assert.isFalse(browser.cdpAvailable);
        assert.equal(browser.getDriverPid(), 12345);
        assert.calledOnceWith(backend.isCdpAvailable, session);
        assert.calledOnceWith(backend.getDriverPid, session);
    });

    it("should use defaults when the backend provides no CDP or driver metadata", async () => {
        const browser = await NewBrowser.create(
            createBrowserConfig_().forBrowser(),
            { startSession: backend.startSession, deleteSession: backend.deleteSession },
            { id: "browser", emitter: new AsyncEmitter() },
        );

        assert.isTrue(browser.cdpAvailable);
        assert.isNull(browser.getDriverPid());
    });

    it("should allow the pool to reset an initialized browser", async () => {
        const browser = await create();

        await assert.isFulfilled(browser.reset());

        assert.calledOnce(backend.startSession);
    });

    describe("quit", () => {
        it("should delete the session gracefully through the backend", async () => {
            const browser = await create();

            await browser.quit();

            assert.calledOnceWith(backend.deleteSession, session, { force: false });
        });

        it("should share pending cleanup across repeated quit and disposal calls", async () => {
            const browser = await create();
            let finish!: () => void;
            backend.deleteSession.returns(
                new Promise<void>(resolve => {
                    finish = resolve;
                }),
            );
            const error = new Error("tests stopped");

            const first = browser.quit(error);
            const second = browser.quit();
            const third = browser[Symbol.asyncDispose]();

            assert.strictEqual(first, second);
            assert.strictEqual(first, third);
            assert.calledOnce(backend.deleteSession);
            finish();
            await first;
            assert.strictEqual(browser.exitError, error);
        });

        it("should preserve session metadata after cleanup", async () => {
            const browser = await create();

            await browser.quit();

            assert.equal(browser.sessionId, session.sessionId);
            assert.strictEqual(browser.publicAPI, session);
        });
    });

    describe("kill", () => {
        it("should request forced deletion when killed before quit", async () => {
            const browser = await create();

            await Promise.all([browser.kill(), browser.quit()]);

            assert.calledOnceWith(backend.deleteSession, session, { force: true });
        });

        it("should escalate graceful cleanup through the backend when killed during quit", async () => {
            const browser = await create();
            let finish!: () => void;
            const closing = new Promise<void>(resolve => {
                finish = resolve;
            });
            backend.deleteSession.returns(closing);

            const graceful = browser.quit();
            const forced = browser.kill();

            assert.calledWith(backend.deleteSession.firstCall, session, { force: false });
            assert.calledWith(backend.deleteSession.secondCall, session, { force: true });
            finish();
            await Promise.all([graceful, forced]);
        });
    });
});
