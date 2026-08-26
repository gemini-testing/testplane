"use strict";

const proxyquire = require("proxyquire").noCallThru();

const MIRROR_ENV_NAMES = [
    "TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_CHROME",
    "TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_CHROMIUM",
    "TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_FIREFOX",
    "testplane_browser_download_mirrors_chrome",
    "testplane_browser_download_mirrors_chromium",
    "testplane_browser_download_mirrors_firefox",
    "hermione_browser_download_mirrors_chrome",
    "hermione_browser_download_mirrors_chromium",
    "hermione_browser_download_mirrors_firefox",
];

describe("browser/standalone/launchBrowser", () => {
    const sandbox = sinon.createSandbox();
    const environmentNames = [...MIRROR_ENV_NAMES, "WDIO_LOG_LEVEL"];

    let savedEnvironment;
    let launchBrowser;
    let receivedConfig;

    beforeEach(() => {
        savedEnvironment = Object.fromEntries(environmentNames.map(name => [name, process.env[name]]));
        environmentNames.forEach(name => delete process.env[name]);

        class NewBrowserStub {
            constructor(config) {
                receivedConfig = config;
                this.publicAPI = {
                    sessionId: "session-id",
                    capabilities: {},
                    options: {},
                };
            }

            async init() {}

            async kill() {}

            getDriverPid() {
                return undefined;
            }
        }

        class ExistingBrowserStub {
            constructor() {
                this.publicAPI = {
                    overwriteCommand: sandbox.stub(),
                    addCommand: sandbox.stub(),
                };
            }

            async init() {}

            async quit() {}
        }

        class WebdriverPoolStub {}
        class CalibratorStub {}

        ({ launchBrowser } = proxyquire("../../../../src/browser/standalone/launchBrowser", {
            "./../new-browser": { NewBrowser: NewBrowserStub },
            "./../existing-browser": { ExistingBrowser: ExistingBrowserStub },
            "./../calibrator": { Calibrator: CalibratorStub },
            "../../browser-pool/webdriver-pool": { WebdriverPool: WebdriverPoolStub },
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

    it("should accept browser download mirrors in standalone options", async () => {
        await launchBrowser({
            browserDownloadMirrors: {
                chrome: "  https://mirror.example/options/chrome///  ",
            },
        });

        assert.equal(receivedConfig.browserDownloadMirrors.chrome, "https://mirror.example/options/chrome");
        assert.notProperty(receivedConfig.forBrowser("chrome"), "browserDownloadMirrors");
    });

    it("should read a browser download mirror from the environment", async () => {
        process.env.TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_CHROME = "https://mirror.example/environment/chrome";

        await launchBrowser();

        assert.equal(receivedConfig.browserDownloadMirrors.chrome, "https://mirror.example/environment/chrome");
    });

    it("should prefer an environment mirror over standalone options", async () => {
        process.env.TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_CHROME = "https://mirror.example/environment/chrome";

        await launchBrowser({
            browserDownloadMirrors: {
                chrome: "https://mirror.example/options/chrome",
            },
        });

        assert.equal(receivedConfig.browserDownloadMirrors.chrome, "https://mirror.example/environment/chrome");
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
