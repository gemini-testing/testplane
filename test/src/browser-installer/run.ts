import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { runBrowserDriver as RunBrowserDriver } from "../../../src/browser-installer/run";
import { Browser } from "../../../src/browser-installer/utils";

describe("browser-installer/run", () => {
    const sandbox = sinon.createSandbox();

    let runBrowserDriver: typeof RunBrowserDriver;

    let installBrowserStub: SinonStub;
    let runChromeDriverStub: SinonStub;

    beforeEach(() => {
        installBrowserStub = sandbox.stub();
        runChromeDriverStub = sandbox.stub();

        runBrowserDriver = proxyquire.noCallThru()("../../../src/browser-installer/run", {
            "./install": { installBrowser: installBrowserStub },
            "./chrome": { runChromeDriver: runChromeDriverStub },
        }).runBrowserDriver;
    });

    afterEach(() => sandbox.restore());

    [true, false, undefined].forEach(debug => {
        it(`should run chrome driver with debug: ${debug}`, async () => {
            await runBrowserDriver(Browser.CHROME, "some-version", { debug });

            assert.calledOnceWith(runChromeDriverStub, "some-version", { debug: Boolean(debug) });
        });
    });

    [Browser.CHROME, Browser.EDGE, Browser.FIREFOX].forEach(browser => {
        it(`should try to install ${browser} before running its driver`, async () => {
            await runBrowserDriver(browser, "some-version");

            assert.calledOnceWith(installBrowserStub, browser, "some-version", {
                shouldInstallWebDriver: true,
                shouldInstallUbuntuPackages: true,
            });
        });
    });
});
