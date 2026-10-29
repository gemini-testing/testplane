"use strict";

const { Config } = require("src/config");
const { ExistingBrowser } = require("src/browser/existing-browser");
const { FullPageScreenShooter } = require("src/browser/screen-shooter/full-page-screen-shooter");
const { captureFailScreenshot } = require("src/worker/runner/test-runner/capture-fail-screenshot");

describe("worker/runner/test-runner/capture-fail-screenshot", () => {
    const sandbox = sinon.createSandbox();
    let browser;
    let clock;
    let capture;
    let execute;
    let deleteSession;
    let httpTimeout;
    const image = {
        getSize: () => ({ width: 1, height: 1 }),
        toPngBuffer: async () => Buffer.from("image"),
    };

    beforeEach(async () => {
        const config = await Config.create({
            browsers: { chrome: { desiredCapabilities: { browserName: "chrome" } } },
            takeScreenshotOnFailsTimeout: 100,
            takeScreenshotOnFailsMode: "fullpage",
        });
        browser = new ExistingBrowser(config, { id: "chrome" });
        execute = sandbox.stub().resolves();
        deleteSession = sandbox.stub().resolves();
        browser._session = {
            commandList: ["execute", "deleteSession"],
            execute,
            deleteSession,
            extendOptions(options) {
                httpTimeout = options.connectionRetryTimeout;
            },
            overwriteCommand(name, fn) {
                this[name] = fn;
            },
        };
        capture = sandbox.stub().resolves(image);
        sandbox.stub(FullPageScreenShooter, "create").resolves({ capture });
        clock = sandbox.useFakeTimers();
    });

    afterEach(() => sandbox.restore());

    for (const reject of [false, true]) {
        it(`should mark browser as broken and block late commands after timeout (${
            reject ? "rejection" : "resolution"
        })`, async () => {
            let finish;
            const pending = new Promise(resolve => {
                finish = resolve;
            });
            capture.callsFake(async () => {
                await pending;
                await browser.publicAPI.execute("cleanupScrolls");
                if (reject) throw new Error("Late screenshot error");
                return image;
            });

            const result = captureFailScreenshot(browser);
            await clock.tickAsync(100);

            assert.isNull(await result);
            assert.isTrue(browser.state.isBroken);
            assert.equal(httpTimeout, browser.config.httpTimeout);
            finish();
            await clock.tickAsync(0);
            assert.notCalled(execute);
            await browser.publicAPI.deleteSession();
            assert.calledOnce(deleteSession);
        });
    }

    it("should keep browser usable after successful capture", async () => {
        const result = await captureFailScreenshot(browser);

        assert.deepEqual(result, { base64: Buffer.from("image").toString("base64"), size: { width: 1, height: 1 } });
        assert.isNotTrue(browser.state.isBroken);
        assert.equal(httpTimeout, browser.config.httpTimeout);
        await browser.publicAPI.execute("nextCommand");
        assert.calledOnce(execute);
    });

    it("should keep browser usable after settled capture error", async () => {
        capture.rejects(new Error("Image composition error"));

        assert.isNull(await captureFailScreenshot(browser));
        assert.isNotTrue(browser.state.isBroken);
        assert.equal(httpTimeout, browser.config.httpTimeout);
        await browser.publicAPI.execute("nextCommand");
        assert.calledOnce(execute);
    });
});
