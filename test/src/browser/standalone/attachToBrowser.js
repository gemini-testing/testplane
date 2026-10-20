"use strict";

const proxyquire = require("proxyquire");

describe("attachToBrowser", () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => sandbox.restore());

    it("should initialize images before initializing existing browser", async () => {
        const initImageStub = sandbox.stub().resolves();
        const existingBrowserInitStub = sandbox.stub().resolves();

        class ConfigStub {
            constructor() {
                this.system = { debug: false };
            }
        }

        class ExistingBrowserStub {
            constructor() {
                this.publicAPI = { overwriteCommand: sandbox.stub() };
                this.init = existingBrowserInitStub;
            }
        }

        const { attachToBrowser } = proxyquire("src/browser/standalone/attachToBrowser", {
            "../../image": { initImage: initImageStub },
            "../../config": { Config: ConfigStub },
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
        });

        await attachToBrowser({
            sessionId: "session-id",
            sessionCaps: { browserName: "chrome" },
            sessionOpts: { capabilities: { browserName: "chrome" } },
        });

        assert.callOrder(initImageStub, existingBrowserInitStub);
    });
});
