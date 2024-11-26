import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { runBrowserDriver as RunBrowserDriver } from "../../../src/browser-installer/run";
import { Driver } from "../../../src/browser-installer/utils";

describe("browser-installer/run", () => {
    const sandbox = sinon.createSandbox();

    let runBrowserDriver: typeof RunBrowserDriver;
    let runChromeDriverStub: SinonStub;

    beforeEach(() => {
        runChromeDriverStub = sandbox.stub();

        runBrowserDriver = proxyquire.noCallThru()("../../../src/browser-installer/run", {
            "./chrome": { runChromeDriver: runChromeDriverStub },
        }).runBrowserDriver;
    });

    afterEach(() => sandbox.restore());

    [true, false, undefined].forEach(debug => {
        it(`should run chrome driver with debug: ${debug}`, async () => {
            await runBrowserDriver(Driver.CHROMEDRIVER, "some-version", { debug });

            assert.calledOnceWith(runChromeDriverStub, "some-version", { debug: Boolean(debug) });
        });
    });
});
