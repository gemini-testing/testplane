"use strict";

const proxyquire = require("proxyquire").noCallThru();

const MIRROR_ENV_NAMES = [
    "TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_CHROME",
    "TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_CHROMIUM",
    "TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_FIREFOX",
    "TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_GECKODRIVER",
    "testplane_browser_download_mirrors_chrome",
    "testplane_browser_download_mirrors_chromium",
    "testplane_browser_download_mirrors_firefox",
    "testplane_browser_download_mirrors_geckodriver",
    "hermione_browser_download_mirrors_chrome",
    "hermione_browser_download_mirrors_chromium",
    "hermione_browser_download_mirrors_firefox",
    "hermione_browser_download_mirrors_geckodriver",
];

describe("browser/standalone/launchBrowser", () => {
    const sandbox = sinon.createSandbox();
    const environmentNames = [...MIRROR_ENV_NAMES, "WDIO_LOG_LEVEL"];

    let savedEnvironment;
    let launchBrowser;
    let receivedConfig;
    let initImageStub;
    let pool;
    let acquirePool;
    let releasePool;
    let disposeAttachment;
    let existingBrowserInitStub;
    let receivedRuntimeOptions;

    beforeEach(() => {
        savedEnvironment = Object.fromEntries(environmentNames.map(name => [name, process.env[name]]));
        environmentNames.forEach(name => delete process.env[name]);

        initImageStub = sandbox.stub().resolves();

        pool = {
            getBrowser: sandbox.stub().callsFake(async config => {
                receivedConfig = config;
                return {
                    publicAPI: { sessionId: "session-id", capabilities: {}, options: {} },
                    getDriverPid: () => 1234,
                    cdpAvailable: true,
                };
            }),
            freeBrowser: sandbox.stub().resolves(),
        };
        releasePool = sandbox.stub().resolves();
        acquirePool = sandbox.stub().callsFake(async options => {
            receivedRuntimeOptions = options;
            return { pool, [Symbol.asyncDispose]: releasePool };
        });
        disposeAttachment = sandbox.stub().resolves();
        existingBrowserInitStub = sandbox.stub().resolves();

        class ExistingBrowserStub {
            constructor() {
                this.publicAPI = {
                    overwriteCommand(name, command) {
                        this[name] = command;
                    },
                    addCommand(name, command) {
                        this[name] = command;
                    },
                };
            }

            init(...args) {
                return existingBrowserInitStub(...args);
            }

            [Symbol.asyncDispose]() {
                return disposeAttachment();
            }
        }

        class CalibratorStub {}

        ({ launchBrowser } = proxyquire("../../../../src/browser/standalone/launchBrowser", {
            "../../image": { initImage: initImageStub },
            "./pool": { acquireStandalonePool: acquirePool },
            "../existing-browser": { ExistingBrowser: ExistingBrowserStub },
            "../calibrator": { Calibrator: CalibratorStub },
        }));
    });

    afterEach(() => {
        environmentNames.forEach(name => {
            if (savedEnvironment[name] === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = savedEnvironment[name];
            }
        });
        sandbox.restore();
    });

    it("should initialize images before initializing new browser", async () => {
        await launchBrowser();

        assert.callOrder(initImageStub, acquirePool, pool.getBrowser, existingBrowserInitStub);
    });

    it("should pass local driver debug settings to the pool", async () => {
        await launchBrowser({ system: { debug: true } });

        assert.isTrue(receivedRuntimeOptions.areLocalWdDebugLogsEnabled);
    });

    it("should release the attachment, session and pool lease once on concurrent close calls", async () => {
        const browser = await launchBrowser();

        await Promise.all([browser.deleteSession(), browser[Symbol.asyncDispose]()]);

        assert.calledOnce(disposeAttachment);
        assert.calledOnce(pool.freeBrowser);
        assert.strictEqual(pool.freeBrowser.firstCall.args[0], await pool.getBrowser.firstCall.returnValue);
        assert.calledOnce(releasePool);
        assert.callOrder(disposeAttachment, pool.freeBrowser, releasePool);
    });

    it("should release the session and lease when attachment fails", async () => {
        const error = new Error("attachment failed");
        existingBrowserInitStub.rejects(error);

        assert.strictEqual(await launchBrowser().catch(err => err), error);
        assert.callOrder(disposeAttachment, pool.freeBrowser, releasePool);
    });

    it("should release the lease if session creation fails", async () => {
        const error = new Error("session failed");
        pool.getBrowser.rejects(error);

        assert.strictEqual(await launchBrowser().catch(err => err), error);
        assert.calledOnce(releasePool);
        assert.notCalled(pool.freeBrowser);
        assert.notCalled(disposeAttachment);
    });

    it("should release the lease even if session cleanup fails", async () => {
        const browser = await launchBrowser();
        const error = new Error("session cleanup failed");
        pool.freeBrowser.rejects(error);

        assert.strictEqual(await browser.deleteSession().catch(err => err), error);
        assert.calledOnce(releasePool);
    });

    it("should use the same browser ID for equivalent configuration", async () => {
        await launchBrowser({ desiredCapabilities: { browserName: "chrome", browserVersion: "123" } });
        const firstId = receivedConfig.id;
        await launchBrowser({ desiredCapabilities: { browserVersion: "123", browserName: "chrome" } });

        assert.equal(receivedConfig.id, firstId);
        await launchBrowser({ desiredCapabilities: { browserName: "chrome", browserVersion: "124" } });
        assert.notEqual(receivedConfig.id, firstId);
    });

    it("should delegate driver PID lookup to the owning browser", async () => {
        const browser = await launchBrowser();

        assert.equal(browser.getDriverPid(), 1234);
    });

    it("should accept browser download mirrors in standalone options", async () => {
        await launchBrowser({
            browserDownloadMirrors: {
                chrome: "  https://mirror.example/options/chrome///  ",
                geckodriver: "  https://mirror.example/options/geckodriver///  ",
            },
        });

        assert.equal(receivedRuntimeOptions.browserDownloadMirrors.chrome, "https://mirror.example/options/chrome");
        assert.equal(
            receivedRuntimeOptions.browserDownloadMirrors.geckodriver,
            "https://mirror.example/options/geckodriver",
        );
        assert.notProperty(receivedConfig, "browserDownloadMirrors");
    });

    it("should read a browser download mirror from the environment", async () => {
        process.env.TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_CHROME = "https://mirror.example/environment/chrome";
        process.env.TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_GECKODRIVER = "https://mirror.example/environment/geckodriver";

        await launchBrowser();

        assert.equal(receivedRuntimeOptions.browserDownloadMirrors.chrome, "https://mirror.example/environment/chrome");
        assert.equal(
            receivedRuntimeOptions.browserDownloadMirrors.geckodriver,
            "https://mirror.example/environment/geckodriver",
        );
    });

    it("should prefer an environment mirror over standalone options", async () => {
        process.env.TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_CHROME = "https://mirror.example/environment/chrome";
        process.env.TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_GECKODRIVER = "https://mirror.example/environment/geckodriver";

        await launchBrowser({
            browserDownloadMirrors: {
                chrome: "https://mirror.example/options/chrome",
                geckodriver: "https://mirror.example/options/geckodriver",
            },
        });

        assert.equal(receivedRuntimeOptions.browserDownloadMirrors.chrome, "https://mirror.example/environment/chrome");
        assert.equal(
            receivedRuntimeOptions.browserDownloadMirrors.geckodriver,
            "https://mirror.example/environment/geckodriver",
        );
    });

    it("should reject an empty environment mirror instead of using standalone options", async () => {
        process.env.TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_CHROME = "";

        await assert.isRejected(
            launchBrowser({
                browserDownloadMirrors: {
                    chrome: "https://mirror.example/options/chrome",
                },
            }),
            '"browserDownloadMirrors.chrome" must not be empty',
        );
    });
});
