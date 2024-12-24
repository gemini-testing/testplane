import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { installChromium as InstallChromiumType } from "../../../../src/browser-installer/chromium/browser";
import { BrowserName } from "../../../../src/browser/types";

describe("browser-installer/chromium/browser", () => {
    const sandbox = sinon.createSandbox();

    let installChromium: typeof InstallChromiumType;

    let getChromiumBuildIdStub: SinonStub;
    let puppeteerInstallStub: SinonStub;
    let canDownloadStub: SinonStub;

    let getBinaryPathStub: SinonStub;
    let getMatchedBrowserVersionStub: SinonStub;
    let installBinaryStub: SinonStub;

    beforeEach(() => {
        puppeteerInstallStub = sandbox.stub().resolves({ executablePath: "/chromium/browser/path" });
        getChromiumBuildIdStub = sandbox.stub().resolves("100500");
        canDownloadStub = sandbox.stub().resolves(true);

        getBinaryPathStub = sandbox.stub().returns(null);
        getMatchedBrowserVersionStub = sandbox.stub().returns(null);
        installBinaryStub = sandbox.stub();

        installChromium = proxyquire("../../../../src/browser-installer/chromium/browser", {
            "@puppeteer/browsers": {
                install: puppeteerInstallStub,
                canDownload: canDownloadStub,
            },
            "./utils": { getChromiumBuildId: getChromiumBuildIdStub },
            "../registry": {
                default: {
                    getBinaryPath: getBinaryPathStub,
                    getMatchedBrowserVersion: getMatchedBrowserVersionStub,
                    installBinary: installBinaryStub,
                },
            },
        }).installChromium;
    });

    afterEach(() => sandbox.restore());

    it("should try to resolve browser path locally by default", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.CHROMIUM, sinon.match.string, "80").returns("80");
        getBinaryPathStub.withArgs(BrowserName.CHROMIUM, sinon.match.string, "80").returns("/browser/path");

        const binaryPath = await installChromium("80");

        assert.equal(binaryPath, "/browser/path");
        assert.notCalled(getChromiumBuildIdStub);
        assert.notCalled(installBinaryStub);
    });

    it("should not try to resolve browser path locally with 'force' flag", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.CHROMIUM, sinon.match.string, "80").returns("80");
        getChromiumBuildIdStub.withArgs(BrowserName.CHROMIUM, sinon.match.string, "80").resolves("100500");

        installBinaryStub
            .withArgs(BrowserName.CHROMIUM, sinon.match.string, "80", sinon.match.func)
            .resolves("/new/downloaded/browser/path");

        const binaryPath = await installChromium("80", { force: true });

        assert.notCalled(getBinaryPathStub);
        assert.equal(binaryPath, "/new/downloaded/browser/path");
    });

    it("should download browser if it is not downloaded", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.CHROMIUM, sinon.match.string, "80").returns(null);
        getChromiumBuildIdStub.withArgs(BrowserName.CHROMIUM, sinon.match.string, "80").resolves("100500");
        installBinaryStub
            .withArgs(BrowserName.CHROMIUM, sinon.match.string, "80", sinon.match.func)
            .resolves("/new/downloaded/browser/path");

        const binaryPath = await installChromium("80");

        assert.equal(binaryPath, "/new/downloaded/browser/path");
    });

    it("should throw an error if version is too low", async () => {
        getMatchedBrowserVersionStub.returns(null);

        await assert.isRejected(
            installChromium("60"),
            [
                "chrome@60 can't be installed.",
                "Automatic browser downloader is not available for chrome versions < 73",
            ].join("\n"),
        );
        assert.notCalled(getChromiumBuildIdStub);
        assert.notCalled(installBinaryStub);
    });

    it("should throw an error if can't download the browser", async () => {
        getMatchedBrowserVersionStub.withArgs(BrowserName.CHROMIUM, sinon.match.string, "115").returns(null);
        getChromiumBuildIdStub.withArgs(BrowserName.CHROMIUM, sinon.match.string, "115").resolves("100500");
        canDownloadStub.resolves(false);

        await assert.isRejected(
            installChromium("115"),
            [
                `chrome@115 can't be installed.`,
                `Probably the version '115' is invalid, please try another version.`,
                "Version examples: '93', '93.0'",
            ].join("\n"),
        );
    });
});
