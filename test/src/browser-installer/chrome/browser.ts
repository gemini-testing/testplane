import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import { BrowserName } from "../../../../src/browser/types";
import type { installChrome as InstallChromeType } from "../../../../src/browser-installer/chrome/browser";

describe("browser-installer/chrome/browser", () => {
    const sandbox = sinon.createSandbox();

    let installChrome: typeof InstallChromeType;

    let installChromiumStub: SinonStub;

    let resolveBuildIdStub: SinonStub;
    let puppeteerInstallStub: SinonStub;
    let canDownloadStub: SinonStub;

    let getBinaryPathStub: SinonStub;
    let getMatchedBrowserVersionStub: SinonStub;
    let installBinaryStub: SinonStub;

    let installChromeDriverStub: SinonStub;
    let installUbuntuPackageDependenciesStub: SinonStub;

    beforeEach(() => {
        installChromiumStub = sandbox.stub().resolves("/chromium/browser/path");

        puppeteerInstallStub = sandbox.stub().resolves({ executablePath: "/chrome/browser/path" });
        resolveBuildIdStub = sandbox.stub().resolves("115.0.5780.170");
        canDownloadStub = sandbox.stub().resolves(true);

        getBinaryPathStub = sandbox.stub().returns(null);
        getMatchedBrowserVersionStub = sandbox.stub().returns(null);
        installBinaryStub = sandbox.stub();

        installChromeDriverStub = sandbox.stub();
        installUbuntuPackageDependenciesStub = sandbox.stub();

        installChrome = proxyquire("../../../../src/browser-installer/chrome/browser", {
            "./driver": { installChromeDriver: installChromeDriverStub },
            "../chromium": { installChromium: installChromiumStub },
            "../ubuntu-packages": { installUbuntuPackageDependencies: installUbuntuPackageDependenciesStub },
            "@puppeteer/browsers": {
                resolveBuildId: resolveBuildIdStub,
                install: puppeteerInstallStub,
                canDownload: canDownloadStub,
            },
            "../registry": {
                default: {
                    getBinaryPath: getBinaryPathStub,
                    getMatchedBrowserVersion: getMatchedBrowserVersionStub,
                    installBinary: installBinaryStub,
                },
            },
        }).installChrome;
    });

    afterEach(() => sandbox.restore());

    it("should try to resolve browser path locally by default", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").returns("115.0");
        getBinaryPathStub.withArgs(BrowserName.CHROME, sinon.match.string, "115.0").returns("/browser/path");

        const binaryPath = await installChrome("115");

        assert.equal(binaryPath, "/browser/path");
        assert.notCalled(resolveBuildIdStub);
        assert.notCalled(installBinaryStub);
    });

    it("should not try to resolve browser path locally with 'force' flag", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").returns("115.0");
        resolveBuildIdStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").resolves("115.0.5678.170");

        installBinaryStub
            .withArgs(BrowserName.CHROME, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/downloaded/browser/path");

        const binaryPath = await installChrome("115", { force: true });

        assert.notCalled(getBinaryPathStub);
        assert.equal(binaryPath, "/new/downloaded/browser/path");
    });

    it("should download browser if it is not downloaded", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").returns(null);
        resolveBuildIdStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").resolves("115.0.5678.170");
        installBinaryStub
            .withArgs(BrowserName.CHROME, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/downloaded/browser/path");

        const binaryPath = await installChrome("115");

        assert.equal(binaryPath, "/new/downloaded/browser/path");
    });

    it("should use chromium browser download if version is too low", async () => {
        getMatchedBrowserVersionStub.returns(null);
        installChromiumStub.withArgs("80").resolves("/browser/chromium/path");

        const result = await installChrome("80");

        assert.equal(result, "/browser/chromium/path");
        assert.notCalled(resolveBuildIdStub);
        assert.notCalled(installBinaryStub);
    });

    it("should throw an error if can't download the browser", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").returns(null);
        resolveBuildIdStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").resolves("115");
        canDownloadStub.resolves(false);

        await assert.isRejected(
            installChrome("115"),
            [
                `chrome@115 can't be installed.`,
                `Probably the version '115' is invalid, please try another version.`,
                "Version examples: '120', '120.0'",
            ].join("\n"),
        );
    });

    it("should try to install chromedriver if 'needWebDriver' is set", async () => {
        await installChrome("115", { needWebDriver: true });

        assert.calledOnceWith(installChromeDriverStub, "115", { force: false });
    });

    it("should try to install ubuntu dependencies if 'needWebDriver' is set", async () => {
        await installChrome("115", { needUbuntuPackages: true });

        assert.calledOnceWith(installUbuntuPackageDependenciesStub);
    });
});
