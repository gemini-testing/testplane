"use strict";

const proxyquire = require("proxyquire");

describe("launchBrowser", () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => sandbox.restore());

    it("should initialize images before initializing new browser", async () => {
        const initImageStub = sandbox.stub().resolves();
        const newBrowserInitStub = sandbox.stub().resolves();

        class ConfigStub {
            constructor() {
                this.system = { debug: false };
            }
        }

        class NewBrowserStub {
            constructor() {
                this.publicAPI = {
                    sessionId: "session-id",
                    capabilities: { browserName: "chrome" },
                    options: {},
                };
                this.init = newBrowserInitStub;
                this.kill = sandbox.stub().resolves();
            }
        }

        class ExistingBrowserStub {
            constructor() {
                this.publicAPI = {
                    overwriteCommand: sandbox.stub(),
                    addCommand: sandbox.stub(),
                };
                this.init = sandbox.stub().resolves();
                this.quit = sandbox.stub();
            }
        }

        const { launchBrowser } = proxyquire("src/browser/standalone/launchBrowser", {
            "../../image": { initImage: initImageStub },
            "../../config": { Config: ConfigStub },
            "./../new-browser": { NewBrowser: NewBrowserStub },
            "./../existing-browser": { ExistingBrowser: ExistingBrowserStub },
            "./../calibrator": { Calibrator: class CalibratorStub {} },
            "../../events": {
                AsyncEmitter: class AsyncEmitterStub {
                    on() {}
                },
                MasterEvents: { ADD_FILE_TO_REMOVE: "addFileToRemove" },
            },
            "./../types": { BrowserName: { CHROME: "chrome" } },
            "../../utils/browser": { getNormalizedBrowserName: sandbox.stub().returns("chrome") },
            "../../browser-pool/webdriver-pool": { WebdriverPool: class WebdriverPoolStub {} },
        });

        await launchBrowser();

        assert.callOrder(initImageStub, newBrowserInitStub);
    });
});
