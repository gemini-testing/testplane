import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { BrowserConfig } from "src/config/browser-config";
import type { DockerBrowserBackend } from "src/browser-backend/docker";
import { createBrowserConfig_, mkSessionStub_ } from "../browser/utils";

describe("browser-backend/docker", () => {
    const sandbox = sinon.createSandbox();
    let Backend: typeof DockerBrowserBackend;
    let backends: DockerBrowserBackend[];
    let session: ReturnType<typeof mkSessionStub_>;
    let controller: {
        gridUrl: string;
        ensureBrowser: SinonStub;
        extendCapabilities: SinonStub;
        prepareCdp: SinonStub;
        getLogs: SinonStub;
        saveSessionLogs: SinonStub;
        [Symbol.asyncDispose]: SinonStub;
    };
    let createController: SinonStub;
    let remote: SinonStub;
    let warn: SinonStub;
    let log: SinonStub;

    const makeConfig = (options: Partial<BrowserConfig> = {}): BrowserConfig =>
        createBrowserConfig_({
            id: "chrome",
            gridUrl: "docker",
            docker: { image: "chrome:1", selenoidImage: "selenoid:1" },
            desiredCapabilities: { browserName: "chrome", browserVersion: "115.0" },
            ...options,
        }).forBrowser();

    const startBackend = async (configs = [makeConfig()]): Promise<DockerBrowserBackend> => {
        const backend = await Backend.start(configs);
        backends.push(backend);

        return backend;
    };

    beforeEach(() => {
        backends = [];
        session = mkSessionStub_();
        controller = {
            gridUrl: "http://127.0.0.1:23456/wd/hub",
            ensureBrowser: sandbox.stub().resolves(),
            extendCapabilities: sandbox.stub().callsFake(capabilities => capabilities),
            prepareCdp: sandbox.stub().resolves(true),
            getLogs: sandbox.stub().resolves("selenoid-output"),
            saveSessionLogs: sandbox.stub().resolves("/tmp/session.log"),
            [Symbol.asyncDispose]: sandbox.stub().resolves(),
        };
        createController = sandbox.stub().resolves(controller);
        remote = sandbox.stub().resolves(session);
        warn = sandbox.stub();
        log = sandbox.stub();

        class ControllerStub {
            static create = createController;
        }

        Backend = proxyquire("src/browser-backend/docker", {
            "./controller": { SelenoidDockerController: ControllerStub },
            "@testplane/webdriverio": { remote },
            "../../utils/logger": { log, warn },
            "../utils": proxyquire("src/browser-backend/utils", { "../utils/logger": { warn } }),
        }).DockerBrowserBackend;
    });

    afterEach(async () => {
        try {
            await Promise.all(backends.map(backend => backend[Symbol.asyncDispose]()));
        } finally {
            sandbox.restore();
        }
    });

    it("should start one controller with the largest requested startup timeout", async () => {
        const configs = [makeConfig({ sessionRequestTimeout: 1000 }), makeConfig({ id: "second", httpTimeout: 2000 })];

        await startBackend(configs);

        assert.calledOnceWith(createController, configs, { timeout: 2000 });
    });

    it("should register the browser and create exactly one session without request retries", async () => {
        const config = makeConfig();
        const backend = await startBackend([config]);

        assert.strictEqual(await backend.startSession(config), session);

        assert.calledOnceWith(controller.ensureBrowser, config);
        assert.calledOnce(remote);
        assert.calledWithMatch(remote, { hostname: "127.0.0.1", port: 23456, connectionRetryCount: 0 });
        assert.callOrder(controller.ensureBrowser, controller.extendCapabilities, remote);
    });

    it("should prepare CDP when the session exposes a Chrome debugger address", async () => {
        session.capabilities = { "goog:chromeOptions": { debuggerAddress: "localhost:9222" } };
        const config = makeConfig({ sessionRequestTimeout: 60000 });
        const backend = await startBackend([config]);

        await backend.startSession(config);

        assert.calledOnceWith(controller.prepareCdp, session.sessionId, sinon.match.string, 60000);
        assert.isTrue(backend.isCdpAvailable(session));
    });

    it("should mark CDP unavailable when the browser image has no adapter", async () => {
        session.capabilities = { "goog:chromeOptions": { debuggerAddress: "localhost:9222" } };
        controller.prepareCdp.resolves(false);
        const backend = await startBackend();

        await backend.startSession(makeConfig());

        assert.isFalse(backend.isCdpAvailable(session));
    });

    it("should skip adapter preparation when a browser websocket endpoint is configured", async () => {
        session.capabilities = { "goog:chromeOptions": { debuggerAddress: "localhost:9222" } };
        const backend = await startBackend();

        await backend.startSession(Object.assign(makeConfig(), { browserWSEndpoint: "ws://browser:9222" }));

        assert.notCalled(controller.prepareCdp);
    });

    it("should skip adapter preparation without a Chrome debugger address", async () => {
        const backend = await startBackend();

        await backend.startSession(makeConfig());

        assert.notCalled(controller.prepareCdp);
    });

    it("should delete a session before saving its logs and only do so once", async () => {
        const backend = await startBackend();
        await backend.startSession(makeConfig());

        await Promise.all([backend.deleteSession(session), backend.deleteSession(session)]);

        assert.calledOnce(session.deleteSession);
        assert.calledOnceWith(controller.saveSessionLogs, session.sessionId, null);
        assert.callOrder(session.deleteSession, controller.saveSessionLogs);
        assert.calledWith(log, "Docker session log: /tmp/session.log");
    });

    it("should preserve a configured Selenoid log filename", async () => {
        const backend = await startBackend();
        await backend.startSession(
            makeConfig({
                desiredCapabilities: { browserName: "chrome", "selenoid:options": { logName: "custom.log" } },
            }),
        );

        await backend.deleteSession(session);

        assert.calledOnceWith(controller.saveSessionLogs, session.sessionId, "custom.log");
    });

    it("should tolerate a failure to save session logs", async () => {
        const backend = await startBackend();
        await backend.startSession(makeConfig());
        controller.saveSessionLogs.rejects(new Error("logs unavailable"));

        await backend.deleteSession(session);

        assert.calledOnce(session.deleteSession);
        assert.calledOnce(warn);
    });

    it("should release the session when CDP preparation fails", async () => {
        session.capabilities = { "goog:chromeOptions": { debuggerAddress: "localhost:9222" } };
        controller.prepareCdp.rejects(new Error("adapter failed"));
        const backend = await startBackend();

        await assert.isRejected(backend.startSession(makeConfig()), "adapter failed");

        assert.calledOnce(session.deleteSession);
        assert.calledOnce(controller.saveSessionLogs);
        assert.notCalled(controller[Symbol.asyncDispose]);
    });

    it("should attach controller logs to a failed session error exactly once", async () => {
        const error = new Error("session not created");
        remote.rejects(error);
        const backend = await startBackend();

        const failure = await backend.startSession(makeConfig()).catch(reason => reason);

        assert.strictEqual(failure, error);
        assert.include(error.message, "session not created");
        assert.equal(error.message.split("selenoid-output").length, 2);
        assert.equal(error.stack!.split("selenoid-output").length, 2);
    });

    it("should preserve a session creation failure when reading controller logs fails", async () => {
        const error = new Error("session not created");
        remote.rejects(error);
        controller.getLogs.rejects(new Error("logs unavailable"));
        const backend = await startBackend();

        const failure = await backend.startSession(makeConfig()).catch(reason => reason);

        assert.strictEqual(failure, error);
        assert.notCalled(session.deleteSession);
    });

    it("should finish session cleanup and log saving before disposing the controller", async () => {
        const backend = await startBackend();
        await backend.startSession(makeConfig());

        await backend[Symbol.asyncDispose]();

        assert.callOrder(session.deleteSession, controller.saveSessionLogs, controller[Symbol.asyncDispose]);
        assert.calledOnce(controller[Symbol.asyncDispose]);
    });
});
