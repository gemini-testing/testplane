import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { installChromeDriverManually as installChromeDriverManuallyType } from "../../../../src/browser-installer/chromium/driver";
import { DriverName } from "../../../../src/browser-installer/utils";

describe("browser-installer/chromium/driver", () => {
    const sandbox = sinon.createSandbox();

    let installChromeDriverManually: typeof installChromeDriverManuallyType;

    let retryFetchStub: SinonStub;
    let installBinaryStub: SinonStub;

    beforeEach(() => {
        retryFetchStub = sandbox.stub().resolves("result");
        installBinaryStub = sandbox.stub();

        installChromeDriverManually = proxyquire("../../../../src/browser-installer/chromium/driver", {
            "../utils": {
                ...require("../../../../src/browser-installer/utils"),
                retryFetch: retryFetchStub,
            },
            "../registry": { default: { installBinary: installBinaryStub } },
        }).installChromeDriverManually;
    });

    afterEach(() => sandbox.restore());

    it("should download driver if it is not downloaded", async () => {
        retryFetchStub.withArgs("https://chromedriver.storage.googleapis.com/LATEST_RELEASE_115").resolves({
            text: () => Promise.resolve("115.0.5678.170"),
        });
        installBinaryStub
            .withArgs(DriverName.CHROMEDRIVER, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/driver/path");

        const driverPath = await installChromeDriverManually("115");

        assert.equal(driverPath, "/driver/path");
    });

    it("should throw an error on unsupported old version", async () => {
        await assert.isRejected(
            installChromeDriverManually("35"),
            [
                "chromedriver@35 can't be installed.",
                "Automatic driver downloader is not available for chrome versions < 73",
            ].join("\n"),
        );
        assert.notCalled(retryFetchStub);
        assert.notCalled(installBinaryStub);
    });
});
