import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { installChromeDriver as InstallChromeDriverType } from "../../../../src/browser-installer/chrome/driver";
import { Driver } from "../../../../src/browser-installer/utils";

describe("browser-installer/chrome/driver", () => {
    const sandbox = sinon.createSandbox();

    let installChromeDriver: typeof InstallChromeDriverType;

    let installChromeDriverManuallyStub: SinonStub;

    let resolveBuildIdStub: SinonStub;
    let puppeteerInstallStub: SinonStub;
    let canDownloadStub: SinonStub;

    let getBinaryPathStub: SinonStub;
    let getMatchedDriverVersionStub: SinonStub;
    let installBinaryStub: SinonStub;

    beforeEach(() => {
        installChromeDriverManuallyStub = sandbox.stub().resolves({ executablePath: "/chromium/driver/path" });

        puppeteerInstallStub = sandbox.stub().resolves({ executablePath: "/chrome/driver/path" });
        resolveBuildIdStub = sandbox.stub().resolves("115.0.5780.170");
        canDownloadStub = sandbox.stub().resolves(true);

        getBinaryPathStub = sandbox.stub().returns(null);
        getMatchedDriverVersionStub = sandbox.stub().returns(null);
        installBinaryStub = sandbox.stub();

        installChromeDriver = proxyquire("../../../../src/browser-installer/chrome/driver", {
            "../chromium": { installChromeDriverManually: installChromeDriverManuallyStub },
            "@puppeteer/browsers": {
                resolveBuildId: resolveBuildIdStub,
                install: puppeteerInstallStub,
                canDownload: canDownloadStub,
            },
            "../registry": {
                default: {
                    getBinaryPath: getBinaryPathStub,
                    getMatchedDriverVersion: getMatchedDriverVersionStub,
                    installBinary: installBinaryStub,
                },
            },
        }).installChromeDriver;
    });

    afterEach(() => sandbox.restore());

    it("should try to resolve driver path locally by default", async () => {
        getMatchedDriverVersionStub.withArgs(Driver.CHROMEDRIVER, sinon.match.string, "115").returns("115.0");
        getBinaryPathStub.withArgs(Driver.CHROMEDRIVER, sinon.match.string, "115.0").returns("/driver/path");

        const driverPath = await installChromeDriver("115");

        assert.equal(driverPath, "/driver/path");
        assert.notCalled(resolveBuildIdStub);
        assert.notCalled(installBinaryStub);
    });

    it("should not try to resolve driver path locally with 'force' flag", async () => {
        getMatchedDriverVersionStub.withArgs(Driver.CHROMEDRIVER, sinon.match.string, "115").returns("115.0");
        resolveBuildIdStub.withArgs(Driver.CHROMEDRIVER, sinon.match.string, "115").resolves("115.0.5678.170");
        installBinaryStub
            .withArgs(Driver.CHROMEDRIVER, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/downloaded/driver/path");

        const driverPath = await installChromeDriver("115", { force: true });

        assert.notCalled(getBinaryPathStub);
        assert.equal(driverPath, "/new/downloaded/driver/path");
    });

    it("should download driver if it is not downloaded", async () => {
        getMatchedDriverVersionStub.withArgs(Driver.CHROMEDRIVER, sinon.match.string, "115").returns(null);
        resolveBuildIdStub.withArgs(Driver.CHROMEDRIVER, sinon.match.string, "115").resolves("115.0.5678.170");
        installBinaryStub
            .withArgs(Driver.CHROMEDRIVER, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/downloaded/driver/path");

        const driverPath = await installChromeDriver("115");

        assert.equal(driverPath, "/new/downloaded/driver/path");
    });

    it("should use chromium driver manual download if version is too low", async () => {
        getMatchedDriverVersionStub.returns(null);
        installChromeDriverManuallyStub.withArgs("80").resolves("/driver/manual/path");

        const result = await installChromeDriver("80");

        assert.equal(result, "/driver/manual/path");
        assert.notCalled(resolveBuildIdStub);
        assert.notCalled(installBinaryStub);
    });

    it("should throw an error if can't download the driver", async () => {
        getMatchedDriverVersionStub.withArgs(Driver.CHROMEDRIVER, sinon.match.string, "115").returns(null);
        resolveBuildIdStub.withArgs(Driver.CHROMEDRIVER, sinon.match.string, "115").resolves("115.0.5678.170");
        canDownloadStub.resolves(false);

        await assert.isRejected(
            installChromeDriver("115"),
            [
                "chromedriver@115.0.5678.170 can't be installed.",
                "Probably the major browser version '115' is invalid",
                "Correct chrome version examples: '123', '124'",
            ].join("\n"),
        );
    });
});
