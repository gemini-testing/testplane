import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { runBrowserDriver as RunBrowserDriver } from "../../../src/browser-installer/run";
import { BrowserName } from "../../../src/browser/types";

describe("browser-installer/run", () => {
    const sandbox = sinon.createSandbox();
    const browserDownloadMirrors = {
        chrome: "https://mirror.example/chrome",
        chromium: null,
        firefox: null,
    };

    let runBrowserDriver: typeof RunBrowserDriver;

    let installBrowserStub: SinonStub;
    let runChromeDriverStub: SinonStub;
    let runGeckoDriverStub: SinonStub;

    beforeEach(() => {
        installBrowserStub = sandbox.stub();
        runChromeDriverStub = sandbox.stub();
        runGeckoDriverStub = sandbox.stub();

        runBrowserDriver = proxyquire.noCallThru()("../../../src/browser-installer/run", {
            "./install": { installBrowser: installBrowserStub },
            "./chrome": { runChromeDriver: runChromeDriverStub },
            "./firefox": { runGeckoDriver: runGeckoDriverStub },
        }).runBrowserDriver;
    });

    afterEach(() => sandbox.restore());

    [true, false, undefined].forEach(debug => {
        it(`should run chrome driver with debug: ${debug}`, async () => {
            await runBrowserDriver(BrowserName.CHROME, "some-version", { debug });

            assert.calledOnceWithExactly(runChromeDriverStub, "some-version", {
                debug: Boolean(debug),
                browserDownloadMirrors: undefined,
            });
        });
    });

    it(`should try to install chrome before running its driver`, async () => {
        await runBrowserDriver(BrowserName.CHROME, "some-version");

        assert.calledOnceWith(installBrowserStub, BrowserName.CHROME, "some-version", {
            shouldInstallWebDriver: true,
            shouldInstallUbuntuPackages: true,
            browserDownloadMirrors: undefined,
        });
        assert.callOrder(installBrowserStub, runChromeDriverStub);
    });

    it("should pass browser download mirrors to installer", async () => {
        await runBrowserDriver(BrowserName.CHROME, "some-version", { browserDownloadMirrors });

        assert.calledOnceWith(installBrowserStub, BrowserName.CHROME, "some-version", {
            shouldInstallWebDriver: true,
            shouldInstallUbuntuPackages: true,
            browserDownloadMirrors,
        });
        assert.calledOnceWithExactly(runChromeDriverStub, "some-version", {
            debug: false,
            browserDownloadMirrors,
        });
    });

    it("should preserve mirrors through the ChromeDriver launch installation seam", async () => {
        const installChromeDriverStub = sandbox.stub().resolves("/driver/path");
        const spawnStub = sandbox.stub().returns({ kill: sandbox.stub() });
        sandbox.stub(process, "once");
        const runChromeDriver = proxyquire("../../../src/browser-installer/chrome", {
            "./driver": { installChromeDriver: installChromeDriverStub },
            "../ubuntu-packages": {
                isUbuntu: sandbox.stub().resolves(false),
                getUbuntuLinkerEnv: sandbox.stub(),
            },
            child_process: { spawn: spawnStub }, // eslint-disable-line camelcase
            "get-port": sandbox.stub().resolves(12345),
            "wait-port": sandbox.stub().resolves(),
        }).runChromeDriver;
        const runBrowserDriverThroughChrome = proxyquire.noCallThru()("../../../src/browser-installer/run", {
            "./install": { installBrowser: installBrowserStub },
            "./chrome": { runChromeDriver },
        }).runBrowserDriver as typeof RunBrowserDriver;

        await runBrowserDriverThroughChrome(BrowserName.CHROME, "stable", { browserDownloadMirrors });

        assert.calledOnceWithExactly(installChromeDriverStub, "stable", { browserDownloadMirrors });
        assert.calledOnce(spawnStub);
    });

    it(`should try to install firefox before running its driver`, async () => {
        await runBrowserDriver(BrowserName.FIREFOX, "some-version");

        assert.calledOnceWith(installBrowserStub, BrowserName.FIREFOX, "some-version", {
            shouldInstallWebDriver: true,
            shouldInstallUbuntuPackages: true,
            browserDownloadMirrors: undefined,
        });
        assert.callOrder(installBrowserStub, runGeckoDriverStub);
    });
});
