import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import { EventEmitter } from "events";
import type { WebdriverPool as WdPoolType } from "src/browser-backend/local/webdriver-pool";

describe("browser-backend/local/webdriver-pool", () => {
    const sandbox = sinon.createSandbox();
    const browserDownloadMirrors = {
        chrome: "https://mirror.example/chrome",
        chromium: null,
        firefox: null,
        geckodriver: null,
    };

    let wdPool: WdPoolType;

    let resolveBrowserVersionStub: SinonStub;
    let runBrowserDriverStub: SinonStub;

    const makeProcess = (): EventEmitter => {
        const child = Object.assign(new EventEmitter(), {
            exitCode: null,
            signalCode: null,
            kill: sandbox.stub(),
        });
        child.kill.callsFake(() => child.emit("exit", 0, null));

        return child;
    };

    beforeEach(() => {
        resolveBrowserVersionStub = sandbox.stub();
        runBrowserDriverStub = sandbox.stub().resolves({
            gridUrl: "http://localhost:12345",
            process: makeProcess(),
            port: 12345,
        });

        const { WebdriverPool } = proxyquire("src/browser-backend/local/webdriver-pool", {
            "../../browser-installer": {
                runBrowserDriver: runBrowserDriverStub,
                resolveBrowserVersion: resolveBrowserVersionStub,
            },
        });

        wdPool = new WebdriverPool();
    });

    afterEach(async () => {
        try {
            await wdPool[Symbol.asyncDispose]();
        } finally {
            sandbox.restore();
        }
    });

    it("should run browser driver", async () => {
        runBrowserDriverStub.resolves({
            gridUrl: "http://localhost:100500",
            process: makeProcess(),
            port: 100500,
        });

        const driver = await wdPool.getWebdriver("MicrosoftEdge", "135.0");

        assert.equal(driver.gridUrl, "http://localhost:100500");
        assert.calledOnceWith(runBrowserDriverStub, "MicrosoftEdge", "135.0", {
            debug: false,
            browserDownloadMirrors: undefined,
        });
    });

    it("should run browser driver with debug mode", async () => {
        await wdPool.getWebdriver("MicrosoftEdge", "135.0", { debug: true });

        assert.calledOnceWith(runBrowserDriverStub, sinon.match.string, sinon.match.string, {
            debug: true,
            browserDownloadMirrors: undefined,
        });
    });

    it("should pass browser download mirrors to browser driver", async () => {
        await wdPool.getWebdriver("chrome", "135.0", { browserDownloadMirrors });

        assert.calledOnceWith(runBrowserDriverStub, "chrome", "135.0", {
            debug: false,
            browserDownloadMirrors,
        });
    });

    it("should pass browser download mirrors when resolving an omitted browser version", async () => {
        resolveBrowserVersionStub.resolves("135.0");

        await wdPool.getWebdriver("chrome", undefined, { browserDownloadMirrors });

        assert.calledOnceWithExactly(resolveBrowserVersionStub, "chrome", { browserDownloadMirrors });
        assert.calledOnceWith(runBrowserDriverStub, "chrome", "135.0", {
            debug: false,
            browserDownloadMirrors,
        });
    });

    it("should pass an undefined mirror map when resolving an omitted browser version", async () => {
        resolveBrowserVersionStub.resolves("135.0");

        await wdPool.getWebdriver("chrome");

        assert.calledOnceWithExactly(resolveBrowserVersionStub, "chrome", { browserDownloadMirrors: undefined });
        assert.calledOnceWith(runBrowserDriverStub, "chrome", "135.0", {
            debug: false,
            browserDownloadMirrors: undefined,
        });
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

        await driver[Symbol.asyncDispose]();

        await wdPool.getWebdriver("MicrosoftEdge", "135.0");

        assert.calledTwice(runBrowserDriverStub);
    });
});
