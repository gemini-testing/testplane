import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { WebdriverPool as WdPoolType } from "../../../src/browser-pool/webdriver-pool";

describe("browser-pool/webdriver-pool", () => {
    const sandbox = sinon.createSandbox();

    let wdPool: WdPoolType;

    let getDriverNameForBrowserNameStub: SinonStub;
    let runBrowserDriverStub: SinonStub;

    beforeEach(() => {
        getDriverNameForBrowserNameStub = sandbox.stub().returns("edgedriver");
        runBrowserDriverStub = sandbox.stub().resolves({
            gridUrl: "http://localhost:12345",
            process: { kill: sandbox.stub() },
            port: 12345,
        });

        const { WebdriverPool } = proxyquire("../../../src/browser-pool/webdriver-pool", {
            "../browser-installer": {
                runBrowserDriver: runBrowserDriverStub,
                getDriverNameForBrowserName: getDriverNameForBrowserNameStub,
            },
        });

        wdPool = new WebdriverPool();
    });

    afterEach(() => sandbox.restore());

    it("should run browser driver", async () => {
        getDriverNameForBrowserNameStub.returns("edgedriver");
        runBrowserDriverStub.resolves({
            gridUrl: "http://localhost:100500",
            process: sandbox.stub(),
            port: 100500,
        });

        const driver = await wdPool.getWebdriver("MicrosoftEdge", "135.0");

        assert.equal(driver.gridUrl, "http://localhost:100500");
        assert.calledOnceWith(runBrowserDriverStub, "edgedriver", "135.0", { debug: false });
    });

    it("should run browser driver with debug mode", async () => {
        await wdPool.getWebdriver("MicrosoftEdge", "135.0");

        assert.calledOnceWith(runBrowserDriverStub, sinon.match.string, sinon.match.string, { debug: false });
    });

    it("should run extra drivers if all of existing ones are busy", async () => {
        await wdPool.getWebdriver("MicrosoftEdge", "135.0");
        await wdPool.getWebdriver("MicrosoftEdge", "135.0");

        assert.calledTwice(runBrowserDriverStub);
    });

    it("should not run extra drivers if driver is freed", async () => {
        const driver = await wdPool.getWebdriver("MicrosoftEdge", "135.0");

        driver.free();

        await wdPool.getWebdriver("MicrosoftEdge", "135.0");

        assert.calledOnce(runBrowserDriverStub);
    });

    it("should run extra drivers if driver is dead", async () => {
        const driver = await wdPool.getWebdriver("MicrosoftEdge", "135.0");

        driver.kill();

        await wdPool.getWebdriver("MicrosoftEdge", "135.0");

        assert.calledTwice(runBrowserDriverStub);
    });
});
