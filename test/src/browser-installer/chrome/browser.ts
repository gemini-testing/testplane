import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { installChrome as InstallChromeType } from "../../../../src/browser-installer/chrome/browser";
import { Browser } from "../../../../src/browser-installer/utils";

describe("browser-installer/chrome/browser", () => {
    const sandbox = sinon.createSandbox();

    let installChrome: typeof InstallChromeType;

    let installChromiumStub: SinonStub;

    let resolveBuildIdStub: SinonStub;
    let puppeteerInstallStub: SinonStub;
    let canDownloadStub: SinonStub;

    let getBinaryPathStub: SinonStub;
    let getMatchingBrowserVersionStub: SinonStub;
    let installBinaryStub: SinonStub;

    beforeEach(() => {
        installChromiumStub = sandbox.stub().resolves("/chromium/browser/path");

        puppeteerInstallStub = sandbox.stub().resolves({ executablePath: "/chrome/browser/path" });
        resolveBuildIdStub = sandbox.stub().resolves("115.0.5780.170");
        canDownloadStub = sandbox.stub().resolves(true);

        getBinaryPathStub = sandbox.stub().returns(null);
        getMatchingBrowserVersionStub = sandbox.stub().returns(null);
        installBinaryStub = sandbox.stub();

        installChrome = proxyquire("../../../../src/browser-installer/chrome/browser", {
            "../chromium": { installChromium: installChromiumStub },
            "@puppeteer/browsers": {
                resolveBuildId: resolveBuildIdStub,
                install: puppeteerInstallStub,
                canDownload: canDownloadStub,
            },
            "../registry": {
                getBinaryPath: getBinaryPathStub,
                getMatchingBrowserVersion: getMatchingBrowserVersionStub,
                installBinary: installBinaryStub,
            },
        }).installChrome;
    });

    afterEach(() => sandbox.restore());

    it("should try to resolve browser path locally without 'force' flag", async () => {
        getMatchingBrowserVersionStub.withArgs(Browser.CHROME, sinon.match.string, "115").returns("115.0");
        getBinaryPathStub.withArgs(Browser.CHROME, sinon.match.string, "115.0").returns("/browser/path");

        const binaryPath = await installChrome("115");

        assert.equal(binaryPath, "/browser/path");
        assert.notCalled(resolveBuildIdStub);
        assert.notCalled(installBinaryStub);
    });

    it("should not try to resolve browser path locally with 'force' flag", async () => {
        getMatchingBrowserVersionStub.withArgs(Browser.CHROME, sinon.match.string, "115").returns("115.0");
        getBinaryPathStub.withArgs(Browser.CHROME, sinon.match.string, "115.0").returns("/browser/path");
        resolveBuildIdStub.withArgs(Browser.CHROME, sinon.match.string, "115").resolves("115.0.5678.170");

        installBinaryStub
            .withArgs(Browser.CHROME, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/browser/path");

        const binaryPath = await installChrome("115", { force: true });

        assert.equal(binaryPath, "/new/browser/path");
    });

    it("should download browser if it is not downloaded", async () => {
        getMatchingBrowserVersionStub.withArgs(Browser.CHROME, sinon.match.string, "115").returns(null);
        resolveBuildIdStub.withArgs(Browser.CHROME, sinon.match.string, "115").resolves("115.0.5678.170");
        installBinaryStub
            .withArgs(Browser.CHROME, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/browser/path");

        const binaryPath = await installChrome("115");

        assert.equal(binaryPath, "/new/browser/path");
    });

    it("should use chromium browser download if version is too low", async () => {
        getMatchingBrowserVersionStub.returns(null);
        installChromiumStub.withArgs("80").resolves("/browser/chromium/path");

        const result = await installChrome("80");

        assert.equal(result, "/browser/chromium/path");
        assert.notCalled(resolveBuildIdStub);
        assert.notCalled(installBinaryStub);
    });

    it("should throw an error if can't download the browser", async () => {
        getMatchingBrowserVersionStub.withArgs(Browser.CHROME, sinon.match.string, "115").returns(null);
        resolveBuildIdStub.withArgs(Browser.CHROME, sinon.match.string, "115").resolves("115");
        canDownloadStub.resolves(false);
        installBinaryStub
            .withArgs(Browser.CHROME, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/browser/path");

        await assert.isRejected(
            installChrome("115"),
            [
                `chrome@115 can't be installed.`,
                `Probably the version '115' is invalid, please try another version.`,
                "Version examples: '120', '120.0'",
            ].join("\n"),
        );
    });
});
