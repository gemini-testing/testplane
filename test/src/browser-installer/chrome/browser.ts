import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import { BrowserName } from "../../../../src/browser/types";
import type {
    installChrome as InstallChromeType,
    resolveLatestChromeVersion as ResolveLatestChromeVersionType,
} from "../../../../src/browser-installer/chrome/browser";

describe("browser-installer/chrome/browser", () => {
    const sandbox = sinon.createSandbox();
    const browserDownloadMirrors = {
        chrome: "https://mirror.example/chrome",
        chromium: "https://mirror.example/chromium",
        firefox: null,
    };

    let installChrome: typeof InstallChromeType;
    let resolveLatestChromeVersion: typeof ResolveLatestChromeVersionType;

    let installChromiumStub: SinonStub;

    let resolveBuildIdStub: SinonStub;
    let puppeteerInstallStub: SinonStub;
    let canDownloadStub: SinonStub;

    let retryFetchStub: SinonStub;

    let getBinaryPathStub: SinonStub;
    let getMatchedBrowserVersionStub: SinonStub;
    let installBinaryStub: SinonStub;

    let installChromeDriverStub: SinonStub;
    let installUbuntuPackageDependenciesStub: SinonStub;
    let resolveChromeBuildIdFromMirrorStub: SinonStub;

    beforeEach(() => {
        installChromiumStub = sandbox.stub().resolves("/chromium/browser/path");

        puppeteerInstallStub = sandbox.stub().resolves({ executablePath: "/chrome/browser/path" });
        resolveBuildIdStub = sandbox.stub().resolves("115.0.5780.170");
        canDownloadStub = sandbox.stub().resolves(true);

        getBinaryPathStub = sandbox.stub().returns(null);
        getMatchedBrowserVersionStub = sandbox.stub().returns(null);
        installBinaryStub = sandbox.stub();

        retryFetchStub = sandbox.stub().resolves({ text: () => Promise.resolve("") });

        installChromeDriverStub = sandbox.stub();
        installUbuntuPackageDependenciesStub = sandbox.stub();
        resolveChromeBuildIdFromMirrorStub = sandbox.stub().resolves("115.0.5790.170");

        ({ installChrome, resolveLatestChromeVersion } = proxyquire(
            "../../../../src/browser-installer/chrome/browser",
            {
                "./driver": { installChromeDriver: installChromeDriverStub },
                "./utils": { resolveChromeBuildIdFromMirror: resolveChromeBuildIdFromMirrorStub },
                "../chromium": { installChromium: installChromiumStub },
                "../ubuntu-packages": { installUbuntuPackageDependencies: installUbuntuPackageDependenciesStub },
                "@puppeteer/browsers": {
                    resolveBuildId: resolveBuildIdStub,
                    install: puppeteerInstallStub,
                    canDownload: canDownloadStub,
                },
                "../utils": {
                    ...require("src/browser-installer/utils"),
                    retryFetch: retryFetchStub,
                },
                "../registry": {
                    default: {
                        getBinaryPath: getBinaryPathStub,
                        getMatchedBrowserVersion: getMatchedBrowserVersionStub,
                        installBinary: installBinaryStub,
                    },
                },
            },
        ));
    });

    afterEach(() => sandbox.restore());

    describe("installChrome", () => {
        it("should try to resolve browser path locally by default", async () => {
            getMatchedBrowserVersionStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").returns("115.0");
            getBinaryPathStub.withArgs(BrowserName.CHROME, sinon.match.string, "115.0").returns("/browser/path");

            const binaryPath = await installChrome(BrowserName.CHROME, "115");

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

            const binaryPath = await installChrome(BrowserName.CHROME, "115", { force: true });

            assert.notCalled(getBinaryPathStub);
            assert.equal(binaryPath, "/new/downloaded/browser/path");
        });

        it("should download browser if it is not downloaded", async () => {
            getMatchedBrowserVersionStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").returns(null);
            resolveBuildIdStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").resolves("115.0.5678.170");
            installBinaryStub
                .withArgs(BrowserName.CHROME, sinon.match.string, "115.0.5678.170", sinon.match.func)
                .resolves("/new/downloaded/browser/path");

            const binaryPath = await installChrome(BrowserName.CHROME, "115");

            assert.equal(binaryPath, "/new/downloaded/browser/path");
        });

        it("should resolve and download browser from mirror", async () => {
            installBinaryStub.callsFake((_browserName, _platform, _version, installFn) => installFn(sandbox.stub()));

            await installChrome(BrowserName.CHROME, "115", { browserDownloadMirrors });

            assert.notCalled(resolveBuildIdStub);
            assert.calledOnceWith(resolveChromeBuildIdFromMirrorStub, "115", browserDownloadMirrors.chrome);
            assert.calledOnceWith(
                canDownloadStub,
                sinon.match({
                    browser: BrowserName.CHROME,
                    buildId: "115.0.5790.170",
                    baseUrl: browserDownloadMirrors.chrome,
                }),
            );
            assert.calledOnceWith(
                puppeteerInstallStub,
                sinon.match({
                    browser: BrowserName.CHROME,
                    buildId: "115.0.5790.170",
                    baseUrl: browserDownloadMirrors.chrome,
                }),
            );
        });

        it("should not expose the mirror URL when the browser artifact download fails", async () => {
            puppeteerInstallStub.rejects(
                new Error(`Download failed. URL: ${browserDownloadMirrors.chrome}/115/chrome.zip`),
            );
            installBinaryStub.callsFake((_browserName, _platform, _version, installFn) => installFn(sandbox.stub()));

            const error = await installChrome(BrowserName.CHROME, "115", { browserDownloadMirrors }).catch(
                error => error,
            );

            assert.instanceOf(error, Error);
            assert.equal(error.message, "Couldn't download browser artifact from the configured mirror");
        });

        it("should not probe mirror artifact URLs when metadata cannot resolve the selector", async () => {
            const error = new Error(
                "Couldn't resolve Chrome-for-Testing build ID for selector '999' from mirror 'https://mirror.example/chrome'",
            );

            resolveChromeBuildIdFromMirrorStub.rejects(error);

            await assert.isRejected(
                installChrome(BrowserName.CHROME, "999", { browserDownloadMirrors }),
                error.message,
            );
            assert.notCalled(canDownloadStub);
            assert.notCalled(installBinaryStub);
        });

        it("should use chromium browser download if version is too low", async () => {
            getMatchedBrowserVersionStub.returns(null);
            installChromiumStub.withArgs("80").resolves("/browser/chromium/path");

            const result = await installChrome(BrowserName.CHROME, "80");

            assert.equal(result, "/browser/chromium/path");
            assert.notCalled(resolveBuildIdStub);
            assert.notCalled(installBinaryStub);
        });

        it("should pass mirrors to chromium fallback", async () => {
            await installChrome(BrowserName.CHROME, "80", { browserDownloadMirrors });

            assert.calledOnceWith(installChromiumStub, "80", {
                force: false,
                browserDownloadMirrors,
            });
        });

        it("should throw an error if can't download the browser", async () => {
            getMatchedBrowserVersionStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").returns(null);
            resolveBuildIdStub.withArgs(BrowserName.CHROME, sinon.match.string, "115").resolves("115");
            canDownloadStub.resolves(false);

            await assert.isRejected(
                installChrome(BrowserName.CHROME, "115"),
                [
                    `chrome@115 can't be installed.`,
                    `Probably the version '115' is invalid, please try another version.`,
                    "Version examples: '120', '120.0'",
                ].join("\n"),
            );
        });

        it("should try to install chromedriver if 'needWebDriver' is set", async () => {
            await installChrome(BrowserName.CHROME, "115", { needWebDriver: true });

            assert.calledOnceWith(installChromeDriverStub, "115", { force: false });
        });

        it("should pass mirrors to chromedriver installer", async () => {
            await installChrome(BrowserName.CHROME, "115", { needWebDriver: true, browserDownloadMirrors });

            assert.calledOnceWith(
                installChromeDriverStub,
                "115",
                sinon.match({
                    force: false,
                    browserDownloadMirrors,
                    resolveMirrorBuildId: sinon.match.func,
                }),
            );
        });

        it("should share one mirror build resolution between paired browser and driver installs", async () => {
            let driverBuildId: string | undefined;

            resolveChromeBuildIdFromMirrorStub.onFirstCall().resolves("115.0.5790.170");
            resolveChromeBuildIdFromMirrorStub.onSecondCall().resolves("115.0.5790.171");
            installBinaryStub.callsFake((_browserName, _platform, _version, installFn) => installFn(sandbox.stub()));
            installChromeDriverStub.callsFake(async (_version, options) => {
                driverBuildId = await options.resolveMirrorBuildId(browserDownloadMirrors.chrome);

                return "/chrome/driver/path";
            });

            await installChrome(BrowserName.CHROME, "115", { needWebDriver: true, browserDownloadMirrors });

            assert.calledOnceWith(resolveChromeBuildIdFromMirrorStub, "115", browserDownloadMirrors.chrome);
            assert.equal(driverBuildId, "115.0.5790.170");
            assert.calledOnceWith(
                puppeteerInstallStub,
                sinon.match({
                    browser: BrowserName.CHROME,
                    buildId: driverBuildId,
                    baseUrl: browserDownloadMirrors.chrome,
                }),
            );
        });

        it("should resolve a shared mirror build lazily", async () => {
            getMatchedBrowserVersionStub
                .withArgs(BrowserName.CHROME, sinon.match.string, "115")
                .returns("115.0.5790.170");
            getBinaryPathStub
                .withArgs(BrowserName.CHROME, sinon.match.string, "115.0.5790.170")
                .returns("/browser/path");
            installChromeDriverStub.resolves("/driver/path");

            await installChrome(BrowserName.CHROME, "115", { needWebDriver: true, browserDownloadMirrors });

            assert.notCalled(resolveChromeBuildIdFromMirrorStub);
        });

        it("should try to install ubuntu dependencies if 'needWebDriver' is set", async () => {
            await installChrome(BrowserName.CHROME, "115", { needUbuntuPackages: true });

            assert.calledOnceWith(installUbuntuPackageDependenciesStub);
        });
    });

    describe("resolveLatestChromeVersion", () => {
        beforeEach(() => {
            retryFetchStub.resolves({ text: () => Promise.resolve(" \n100.0.500.0\t") });
        });

        it("should resolve local version", async () => {
            getMatchedBrowserVersionStub.withArgs(BrowserName.CHROME, sinon.match.string).returns("500.0.100.0");

            const version = await resolveLatestChromeVersion();

            assert.equal(version, "500.0.100.0");
            assert.notCalled(retryFetchStub);
        });

        it("should resolve network version if local does not exist", async () => {
            getMatchedBrowserVersionStub.withArgs(BrowserName.CHROME, sinon.match.string).returns(null);

            const version = await resolveLatestChromeVersion();

            assert.equal(version, "100.0.500.0");
            assert.calledOnce(retryFetchStub);
        });

        it("should resolve network version from mirror", async () => {
            retryFetchStub
                .withArgs("https://mirror.example/chrome/LATEST_RELEASE_STABLE")
                .resolves({ text: () => Promise.resolve(" \n101.0.500.0\t") });

            const version = await resolveLatestChromeVersion(false, browserDownloadMirrors);

            assert.equal(version, "101.0.500.0");
            assert.calledOnceWith(retryFetchStub, "https://mirror.example/chrome/LATEST_RELEASE_STABLE");
        });

        it("should resolve network version on force mode", async () => {
            getMatchedBrowserVersionStub.withArgs(BrowserName.CHROME, sinon.match.string).returns("500.0.100.0");

            const version = await resolveLatestChromeVersion(true);

            assert.equal(version, "100.0.500.0");
            assert.calledOnce(retryFetchStub);
            assert.notCalled(getMatchedBrowserVersionStub);
        });

        it("should memoize result", async () => {
            getMatchedBrowserVersionStub.withArgs(BrowserName.CHROME, sinon.match.string).returns(null);

            await resolveLatestChromeVersion(true);
            await resolveLatestChromeVersion(true);
            await resolveLatestChromeVersion(true);

            assert.calledOnce(retryFetchStub);
        });
    });
});
