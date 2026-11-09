import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { BrowserConfig } from "src/config/browser-config";
import type { LocalBrowserBackend, LocalBrowserBackendOptions } from "src/browser-backend/local";
import { createBrowserConfig_, mkSessionStub_ } from "../browser/utils";

describe("browser-backend/local", () => {
    const sandbox = sinon.createSandbox();
    const browserDownloadMirrors = {
        chrome: "https://mirror.example/chrome",
        chromium: null,
        firefox: null,
        geckodriver: null,
    };
    let Backend: typeof LocalBrowserBackend;
    let backends: LocalBrowserBackend[];
    let session: ReturnType<typeof mkSessionStub_>;
    let driver: { gridUrl: string; free: SinonStub; getPid: SinonStub; [Symbol.asyncDispose]: SinonStub };
    let getWebdriver: SinonStub;
    let disposeDrivers: SinonStub;
    let installBrowser: SinonStub;
    let resolveBrowserVersion: SinonStub;
    let remote: SinonStub;
    let warn: SinonStub;

    const makeConfig = (options: Partial<BrowserConfig> = {}): BrowserConfig =>
        createBrowserConfig_({
            desiredCapabilities: { browserName: "chrome", browserVersion: "115.0" },
            ...options,
        }).forBrowser();

    const makeBackend = (options: LocalBrowserBackendOptions = {}): LocalBrowserBackend => {
        const backend = new Backend(options);
        backends.push(backend);

        return backend;
    };

    beforeEach(() => {
        backends = [];
        session = mkSessionStub_();
        driver = {
            gridUrl: "http://localhost:12345/",
            free: sandbox.stub().resolves(),
            getPid: sandbox.stub().returns(12345),
            [Symbol.asyncDispose]: sandbox.stub().resolves(),
        };
        getWebdriver = sandbox.stub().resolves(driver);
        disposeDrivers = sandbox.stub().resolves();
        installBrowser = sandbox.stub().resolves("/browser/path");
        resolveBrowserVersion = sandbox.stub().resolves("115.0");
        remote = sandbox.stub().resolves(session);
        warn = sandbox.stub();

        class WebdriverPoolStub {
            getWebdriver = getWebdriver;
            [Symbol.asyncDispose] = disposeDrivers;
        }

        Backend = proxyquire("src/browser-backend/local", {
            "./webdriver-pool": { WebdriverPool: WebdriverPoolStub },
            "../../browser-installer": { installBrowser, resolveBrowserVersion },
            "@testplane/webdriverio": { remote },
            "../utils": proxyquire("src/browser-backend/utils", { "../utils/logger": { warn } }),
        }).LocalBrowserBackend;
    });

    afterEach(async () => {
        try {
            await Promise.all(backends.map(backend => backend[Symbol.asyncDispose]()));
        } finally {
            sandbox.restore();
        }
    });

    it("should connect to the local driver and install the browser binary", async () => {
        const result = await makeBackend().startSession(makeConfig());

        assert.strictEqual(result, session);
        assert.calledWithMatch(remote, {
            protocol: "http",
            hostname: "localhost",
            port: 12345,
            path: "/",
            capabilities: {
                browserName: "chrome",
                browserVersion: "115.0",
                "goog:chromeOptions": { binary: "/browser/path" },
            },
        });
    });

    it("should pass debug and download mirrors to the driver and browser installer", async () => {
        await makeBackend({ browserDownloadMirrors, areLocalWdDebugLogsEnabled: true }).startSession(makeConfig());

        assert.calledOnceWith(getWebdriver, "chrome", "115.0", { debug: true, browserDownloadMirrors });
        assert.calledOnceWith(installBrowser, "chrome", "115.0", {
            shouldInstallWebDriver: false,
            shouldInstallUbuntuPackages: true,
            browserDownloadMirrors,
        });
    });

    it("should resolve an omitted version using the configured mirrors", async () => {
        await makeBackend({ browserDownloadMirrors }).startSession(
            makeConfig({ desiredCapabilities: { browserName: "chrome" } }),
        );

        assert.calledOnceWith(resolveBrowserVersion, "chrome", { browserDownloadMirrors });
        assert.calledWith(getWebdriver, "chrome", "115.0");
    });

    it("should use the requested version override for the driver and browser", async () => {
        await makeBackend().startSession(makeConfig(), { browserVersionOverride: "116.0" });

        assert.calledWith(getWebdriver, "chrome", "116.0");
        assert.calledWith(installBrowser, "chrome", "116.0");
        assert.calledWithMatch(remote, { capabilities: { browserVersion: "116.0" } });
    });

    it("should filter capabilities for the selected browser and preserve its binary", async () => {
        const config = makeConfig({
            desiredCapabilities: {
                browserName: "chrome",
                browserVersion: "115.0",
                "goog:chromeOptions": { binary: "/custom/browser" },
                "moz:firefoxOptions": {},
                "selenoid:options": { enableVNC: true },
            },
        });

        await makeBackend().startSession(config);

        assert.deepEqual(remote.firstCall.args[0].capabilities, {
            browserName: "chrome",
            browserVersion: "115.0",
            "goog:chromeOptions": { binary: "/custom/browser" },
            "wdio:enforceWebDriverClassic": true,
        });
    });

    it("should dispose the acquired driver if browser installation fails", async () => {
        const error = new Error("mirror artifact is unavailable");
        installBrowser.rejects(error);

        await assert.isRejected(makeBackend().startSession(makeConfig()), error.message);

        assert.notCalled(remote);
        assert.notCalled(driver.free);
        assert.calledOnce(driver[Symbol.asyncDispose]);
    });

    it("should dispose the acquired driver if session creation fails", async () => {
        remote.rejects(new Error("session creation failed"));

        await assert.isRejected(makeBackend().startSession(makeConfig()), "session creation failed");

        assert.notCalled(driver.free);
        assert.calledOnce(driver[Symbol.asyncDispose]);
    });

    it("should return the driver to its pool after deleting the session", async () => {
        const backend = makeBackend();
        await backend.startSession(makeConfig());

        await backend.deleteSession(session);

        assert.calledOnce(session.deleteSession);
        assert.calledOnce(driver.free);
        assert.callOrder(session.deleteSession, driver.free);
        assert.notCalled(driver[Symbol.asyncDispose]);
    });

    [new Error("session deletion failed"), null, undefined].forEach(error => {
        it(`should dispose the driver if session deletion rejects with ${String(error)}`, async () => {
            const backend = makeBackend();
            await backend.startSession(makeConfig());
            session.deleteSession.callsFake(() => Promise.reject(error));

            await backend.deleteSession(session);

            assert.notCalled(driver.free);
            assert.calledOnce(driver[Symbol.asyncDispose]);
            assert.calledOnce(warn);
        });
    });

    it("should dispose the driver if returning it to the pool fails", async () => {
        const backend = makeBackend();
        await backend.startSession(makeConfig());
        driver.free.rejects(new Error("driver cannot be reused"));

        await backend.deleteSession(session);

        assert.calledOnce(driver[Symbol.asyncDispose]);
    });

    it("should escalate an ongoing graceful session deletion without deleting it twice", async () => {
        const backend = makeBackend();
        await backend.startSession(makeConfig());
        let finish!: () => void;
        session.deleteSession.callsFake(
            () =>
                new Promise<void>(resolve => {
                    finish = resolve;
                }),
        );

        const graceful = backend.deleteSession(session);
        const forced = backend.deleteSession(session, { force: true });
        assert.strictEqual(graceful, forced);
        finish();
        await Promise.all([graceful, forced]);

        assert.calledOnce(session.deleteSession);
        assert.notCalled(driver.free);
        assert.calledOnce(driver[Symbol.asyncDispose]);
    });

    it("should stop exposing the driver PID after deleting the session", async () => {
        const backend = makeBackend();
        await backend.startSession(makeConfig());
        assert.equal(backend.getDriverPid(session), 12345);

        await backend.deleteSession(session);

        assert.isNull(backend.getDriverPid(session));
    });

    it("should close sessions before disposing the driver pool", async () => {
        const backend = makeBackend();
        await backend.startSession(makeConfig());

        await backend[Symbol.asyncDispose]();

        assert.callOrder(session.deleteSession, driver.free, disposeDrivers);
        assert.calledOnce(disposeDrivers);
    });
});
