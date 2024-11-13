import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { installFirefox as InstallFirefoxType } from "../../../../src/browser-installer/firefox/browser";
import { Browser } from "../../../../src/browser-installer/utils";

describe("browser-installer/firefox/browser", () => {
    const sandbox = sinon.createSandbox();

    let installFirefox: typeof InstallFirefoxType;

    let puppeteerInstallStub: SinonStub;
    let canDownloadStub: SinonStub;

    let getBinaryPathStub: SinonStub;
    let getMatchingBrowserVersionStub: SinonStub;
    let installBinaryStub: SinonStub;

    beforeEach(() => {
        puppeteerInstallStub = sandbox.stub().resolves({ executablePath: "/firefox/browser/path" });
        canDownloadStub = sandbox.stub().resolves(true);

        getBinaryPathStub = sandbox.stub().returns(null);
        getMatchingBrowserVersionStub = sandbox.stub().returns(null);
        installBinaryStub = sandbox.stub();

        installFirefox = proxyquire("../../../../src/browser-installer/firefox/browser", {
            "@puppeteer/browsers": {
                install: puppeteerInstallStub,
                canDownload: canDownloadStub,
            },
            "../registry": {
                getBinaryPath: getBinaryPathStub,
                getMatchingBrowserVersion: getMatchingBrowserVersionStub,
                installBinary: installBinaryStub,
            },
        }).installFirefox;
    });

    afterEach(() => sandbox.restore());

    it("should try to resolve browser path locally without 'force' flag", async () => {
        getMatchingBrowserVersionStub.withArgs(Browser.FIREFOX, sinon.match.string, "115").returns("115.0");
        getBinaryPathStub.withArgs(Browser.FIREFOX, sinon.match.string, "115.0").returns("/browser/path");

        const binaryPath = await installFirefox("115");

        assert.equal(binaryPath, "/browser/path");
        assert.notCalled(installBinaryStub);
    });

    it("should not try to resolve browser path locally with 'force' flag", async () => {
        getMatchingBrowserVersionStub.withArgs(Browser.FIREFOX, sinon.match.string, "115").returns("stable_115.0");
        getBinaryPathStub.withArgs(Browser.FIREFOX, sinon.match.string, "stable_115.0").returns("/browser/path");

        installBinaryStub
            .withArgs(Browser.FIREFOX, sinon.match.string, "stable_115.0", sinon.match.func)
            .resolves("/new/browser/path");

        const binaryPath = await installFirefox("115", { force: true });

        assert.equal(binaryPath, "/new/browser/path");
    });

    it("should download browser if it is not downloaded", async () => {
        getMatchingBrowserVersionStub.withArgs(Browser.FIREFOX, sinon.match.string, "115").returns(null);
        installBinaryStub
            .withArgs(Browser.FIREFOX, sinon.match.string, "stable_115.0", sinon.match.func)
            .resolves("/new/browser/path");

        const binaryPath = await installFirefox("115");

        assert.equal(binaryPath, "/new/browser/path");
    });

    it("should throw an error if can't download the browser", async () => {
        getMatchingBrowserVersionStub.withArgs(Browser.FIREFOX, sinon.match.string, "115").returns(null);
        canDownloadStub.resolves(false);
        installBinaryStub
            .withArgs(Browser.FIREFOX, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/browser/path");

        await assert.isRejected(
            installFirefox("115"),
            [
                `firefox@115 can't be installed.`,
                `Probably the version '115' is invalid, please try another version.`,
                "Version examples: '120', '130.0', '131.0'",
            ].join("\n"),
        );
    });
});
