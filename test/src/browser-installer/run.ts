import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { runBrowserDriver as RunBrowserDriver } from "../../../src/browser-installer/run";
import { Driver } from "../../../src/browser-installer/utils";

describe("browser-installer/run", () => {
    const sandbox = sinon.createSandbox();

    let runBrowserDriver: typeof RunBrowserDriver;
    let runChromeDriverStub: SinonStub;
    let runEdgeDriverStub: SinonStub;
    let runGeckoDriverStub: SinonStub;
    let runSafariDriverStub: SinonStub;

    beforeEach(() => {
        runChromeDriverStub = sandbox.stub();
        runEdgeDriverStub = sandbox.stub();
        runGeckoDriverStub = sandbox.stub();
        runSafariDriverStub = sandbox.stub();

        runBrowserDriver = proxyquire("../../../src/browser-installer/run", {
            "./chrome": { runChromeDriver: runChromeDriverStub },
            "./edge": { runEdgeDriver: runEdgeDriverStub },
            "./firefox": { runGeckoDriver: runGeckoDriverStub },
            "./safari": { runSafariDriver: runSafariDriverStub },
        }).runBrowserDriver;
    });

    afterEach(() => sandbox.restore());

    [true, false, undefined].forEach(debug => {
        it(`should run chrome driver with debug: ${debug}`, async () => {
            await runBrowserDriver(Driver.CHROMEDRIVER, "some-version", { debug });

            assert.calledOnceWith(runChromeDriverStub, "some-version", { debug: Boolean(debug) });
        });

        it(`should run edge driver with debug: ${debug}`, async () => {
            await runBrowserDriver(Driver.EDGEDRIVER, "some-version", { debug });

            assert.calledOnceWith(runEdgeDriverStub, "some-version", { debug: Boolean(debug) });
        });

        it(`should run gecko driver with debug: ${debug}`, async () => {
            await runBrowserDriver(Driver.GECKODRIVER, "some-version", { debug });

            assert.calledOnceWith(runGeckoDriverStub, "some-version", { debug: Boolean(debug) });
        });

        it(`should run safari driver with debug: ${debug}`, async () => {
            await runBrowserDriver(Driver.SAFARIDRIVER, "some-version", { debug });

            assert.calledOnceWith(runSafariDriverStub, { debug: Boolean(debug) });
        });
    });
});
