import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { installFirefox as InstallFirefoxType } from "../../../../src/browser-installer/firefox/browser";
import { BrowserName } from "../../../../src/browser/types";

describe("browser-installer/firefox/browser", () => {
    const sandbox = sinon.createSandbox();

    let installFirefox: typeof InstallFirefoxType;

    let puppeteerInstallStub: SinonStub;
    let canDownloadStub: SinonStub;

    let getBinaryPathStub: SinonStub;
    let getMatchedBrowserVersionStub: SinonStub;
    let installBinaryStub: SinonStub;

    let installLatestGeckoDriverStub: SinonStub;
    let installUbuntuPackageDependenciesStub: SinonStub;

    beforeEach(() => {
        puppeteerInstallStub = sandbox.stub().resolves({ executablePath: "/firefox/browser/path" });
        canDownloadStub = sandbox.stub().resolves(true);

        getBinaryPathStub = sandbox.stub().returns(null);
        getMatchedBrowserVersionStub = sandbox.stub().returns(null);
        installBinaryStub = sandbox.stub();

        installLatestGeckoDriverStub = sandbox.stub();
        installUbuntuPackageDependenciesStub = sandbox.stub();

        installFirefox = proxyquire("../../../../src/browser-installer/firefox/browser", {
            "./driver": { installLatestGeckoDriver: installLatestGeckoDriverStub },
            "../ubuntu-packages": { installUbuntuPackageDependencies: installUbuntuPackageDependenciesStub },
            "@puppeteer/browsers": {
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
        }).installFirefox;
    });

    afterEach(() => sandbox.restore());

    it("should try to resolve browser path locally by default", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.FIREFOX, sinon.match.string, "115").returns("115.0");
        getBinaryPathStub.withArgs(BrowserName.FIREFOX, sinon.match.string, "115.0").returns("/browser/path");

        const binaryPath = await installFirefox("115");

        assert.equal(binaryPath, "/browser/path");
        assert.notCalled(installBinaryStub);
    });

    it("should not try to resolve browser path locally with 'force' flag", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.FIREFOX, sinon.match.string, "115").returns("stable_115.0");
        installBinaryStub
            .withArgs(BrowserName.FIREFOX, sinon.match.string, "stable_115.0", sinon.match.func)
            .resolves("/new/downloaded/browser/path");

        const binaryPath = await installFirefox("115", { force: true });

        assert.notCalled(getBinaryPathStub);
        assert.equal(binaryPath, "/new/downloaded/browser/path");
    });

    it("should download browser if it is not downloaded", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.FIREFOX, sinon.match.string, "115").returns(null);
        installBinaryStub
            .withArgs(BrowserName.FIREFOX, sinon.match.string, "stable_115.0", sinon.match.func)
            .resolves("/new/downloaded/browser/path");

        const binaryPath = await installFirefox("115");

        assert.equal(binaryPath, "/new/downloaded/browser/path");
    });

    it("should throw an error if can't download the browser", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.FIREFOX, sinon.match.string, "115").returns(null);
        canDownloadStub.resolves(false);

        await assert.isRejected(
            installFirefox("115"),
            [
                `firefox@115 can't be installed.`,
                `Probably the version '115' is invalid, please try another version.`,
                "Version examples: '120', '130.0', '131.0'",
            ].join("\n"),
        );
    });

    it("should try to install geckodriver if 'needWebDriver' is set", async () => {
        await installFirefox("115", { needWebDriver: true });

        assert.calledOnceWith(installLatestGeckoDriverStub, "115", { force: false });
    });

    it("should try to install ubuntu dependencies if 'needWebDriver' is set", async () => {
        await installFirefox("115", { needUbuntuPackages: true });

        assert.calledOnceWith(installUbuntuPackageDependenciesStub);
    });
});
