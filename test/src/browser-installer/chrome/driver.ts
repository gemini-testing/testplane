import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { installChromeDriver as InstallChromeDriverType } from "../../../../src/browser-installer/chrome/driver";
import { DriverName } from "../../../../src/browser-installer/utils";

describe("browser-installer/chrome/driver", () => {
    const sandbox = sinon.createSandbox();
    const browserDownloadMirrors = {
        chrome: "https://mirror.example/chrome",
        chromium: null,
        firefox: null,
    };

    let installChromeDriver: typeof InstallChromeDriverType;

    let installChromeDriverManuallyStub: SinonStub;

    let resolveBuildIdStub: SinonStub;
    let puppeteerInstallStub: SinonStub;
    let canDownloadStub: SinonStub;
    let resolveChromeBuildIdFromMirrorStub: SinonStub;

    let getBinaryPathStub: SinonStub;
    let getMatchedDriverVersionStub: SinonStub;
    let installBinaryStub: SinonStub;

    beforeEach(() => {
        installChromeDriverManuallyStub = sandbox.stub().resolves({ executablePath: "/chromium/driver/path" });

        puppeteerInstallStub = sandbox.stub().resolves({ executablePath: "/chrome/driver/path" });
        resolveBuildIdStub = sandbox.stub().resolves("115.0.5780.170");
        canDownloadStub = sandbox.stub().resolves(true);
        resolveChromeBuildIdFromMirrorStub = sandbox.stub().resolves("115.0.5790.170");

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
            "./utils": { resolveChromeBuildIdFromMirror: resolveChromeBuildIdFromMirrorStub },
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
        getMatchedDriverVersionStub.withArgs(DriverName.CHROMEDRIVER, sinon.match.string, "115").returns("115.0");
        getBinaryPathStub.withArgs(DriverName.CHROMEDRIVER, sinon.match.string, "115.0").returns("/driver/path");

        const driverPath = await installChromeDriver("115");

        assert.equal(driverPath, "/driver/path");
        assert.notCalled(resolveBuildIdStub);
        assert.notCalled(installBinaryStub);
    });

    it("should not try to resolve driver path locally with 'force' flag", async () => {
        getMatchedDriverVersionStub.withArgs(DriverName.CHROMEDRIVER, sinon.match.string, "115").returns("115.0");
        resolveBuildIdStub.withArgs(DriverName.CHROMEDRIVER, sinon.match.string, "115").resolves("115.0.5678.170");
        installBinaryStub
            .withArgs(DriverName.CHROMEDRIVER, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/downloaded/driver/path");

        const driverPath = await installChromeDriver("115", { force: true });

        assert.notCalled(getBinaryPathStub);
        assert.equal(driverPath, "/new/downloaded/driver/path");
    });

    it("should download driver if it is not downloaded", async () => {
        getMatchedDriverVersionStub.withArgs(DriverName.CHROMEDRIVER, sinon.match.string, "115").returns(null);
        resolveBuildIdStub.withArgs(DriverName.CHROMEDRIVER, sinon.match.string, "115").resolves("115.0.5678.170");
        installBinaryStub
            .withArgs(DriverName.CHROMEDRIVER, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/downloaded/driver/path");

        const driverPath = await installChromeDriver("115");

        assert.equal(driverPath, "/new/downloaded/driver/path");
    });

    it("should resolve and download driver from mirror", async () => {
        installBinaryStub.callsFake((_driverName, _platform, _version, installFn) => installFn(sandbox.stub()));

        await installChromeDriver("115", { browserDownloadMirrors });

        assert.notCalled(resolveBuildIdStub);
        assert.calledOnceWith(resolveChromeBuildIdFromMirrorStub, "115", browserDownloadMirrors.chrome);
        assert.calledOnceWith(
            canDownloadStub,
            sinon.match({
                browser: DriverName.CHROMEDRIVER,
                buildId: "115.0.5790.170",
                baseUrl: browserDownloadMirrors.chrome,
            }),
        );
        assert.calledOnceWith(
            puppeteerInstallStub,
            sinon.match({
                browser: DriverName.CHROMEDRIVER,
                buildId: "115.0.5790.170",
                baseUrl: browserDownloadMirrors.chrome,
            }),
        );
    });

    it("should not expose the mirror URL when the driver artifact download fails", async () => {
        puppeteerInstallStub.rejects(
            new Error(`Download failed. URL: ${browserDownloadMirrors.chrome}/115/chromedriver.zip`),
        );
        installBinaryStub.callsFake((_driverName, _platform, _version, installFn) => installFn(sandbox.stub()));

        const error = await installChromeDriver("115", { browserDownloadMirrors }).catch(error => error);

        assert.instanceOf(error, Error);
        assert.equal(error.message, "Couldn't download browser artifact from the configured mirror");
    });

    it("should use a shared mirror build resolver when provided", async () => {
        const resolveMirrorBuildIdStub = sandbox.stub().resolves("115.0.5790.171");

        installBinaryStub.callsFake((_driverName, _platform, _version, installFn) => installFn(sandbox.stub()));

        await installChromeDriver("115", {
            browserDownloadMirrors,
            resolveMirrorBuildId: resolveMirrorBuildIdStub,
        });

        assert.calledOnceWith(resolveMirrorBuildIdStub, browserDownloadMirrors.chrome);
        assert.notCalled(resolveChromeBuildIdFromMirrorStub);
        assert.calledOnceWith(
            canDownloadStub,
            sinon.match({
                browser: DriverName.CHROMEDRIVER,
                buildId: "115.0.5790.171",
                baseUrl: browserDownloadMirrors.chrome,
            }),
        );
        assert.calledOnceWith(
            puppeteerInstallStub,
            sinon.match({
                browser: DriverName.CHROMEDRIVER,
                buildId: "115.0.5790.171",
                baseUrl: browserDownloadMirrors.chrome,
            }),
        );
    });

    it("should use chromium driver manual download if version is too low", async () => {
        getMatchedDriverVersionStub.returns(null);
        installChromeDriverManuallyStub.withArgs("80").resolves("/driver/manual/path");

        const result = await installChromeDriver("80");

        assert.equal(result, "/driver/manual/path");
        assert.notCalled(resolveBuildIdStub);
        assert.notCalled(installBinaryStub);
    });

    it("should keep ChromeDriver below 115 on the legacy source when a mirror is configured", async () => {
        getMatchedDriverVersionStub.returns(null);
        installChromeDriverManuallyStub.withArgs("114").resolves("/driver/manual/path");

        const result = await installChromeDriver("114", { browserDownloadMirrors });

        assert.equal(result, "/driver/manual/path");
        assert.notCalled(resolveChromeBuildIdFromMirrorStub);
        assert.notCalled(resolveBuildIdStub);
        assert.notCalled(installBinaryStub);
    });

    it("should throw an error if can't download the driver", async () => {
        getMatchedDriverVersionStub.withArgs(DriverName.CHROMEDRIVER, sinon.match.string, "115").returns(null);
        resolveBuildIdStub.withArgs(DriverName.CHROMEDRIVER, sinon.match.string, "115").resolves("115.0.5678.170");
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
