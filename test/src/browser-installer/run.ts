import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { runBrowserDriver as RunBrowserDriver } from "../../../src/browser-installer/run";
import { BrowserName } from "../../../src/browser/types";

describe("browser-installer/run", () => {
    const sandbox = sinon.createSandbox();

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

            assert.calledOnceWith(runChromeDriverStub, "some-version", { debug: Boolean(debug) });
        });
    });

    it(`should try to install chrome before running its driver`, async () => {
        await runBrowserDriver(BrowserName.CHROME, "some-version");

        assert.calledOnceWith(installBrowserStub, BrowserName.CHROME, "some-version", {
            shouldInstallWebDriver: true,
            shouldInstallUbuntuPackages: true,
        });
        assert.callOrder(installBrowserStub, runChromeDriverStub);
    });

    it(`should try to install firefox before running its driver`, async () => {
        await runBrowserDriver(BrowserName.FIREFOX, "some-version");

        assert.calledOnceWith(installBrowserStub, BrowserName.FIREFOX, "some-version", {
            shouldInstallWebDriver: true,
            shouldInstallUbuntuPackages: true,
        });
        assert.callOrder(installBrowserStub, runGeckoDriverStub);
    });
});
