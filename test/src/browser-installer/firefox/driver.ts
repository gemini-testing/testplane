import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import { BrowserPlatform } from "@puppeteer/browsers";
import type { installLatestGeckoDriver as InstallLatestGeckoDriverType } from "../../../../src/browser-installer/firefox/driver";
import { DriverName } from "../../../../src/browser-installer/utils";

describe("browser-installer/firefox/driver", () => {
    const sandbox = sinon.createSandbox();
    const browserDownloadMirrors = {
        chrome: null,
        chromium: null,
        firefox: "https://mirror.example/firefox",
        geckodriver: "https://mirror.example/cache/geckodriver",
    };

    let installLatestGeckoDriver: typeof InstallLatestGeckoDriverType;

    let downloadGeckoDriverStub: SinonStub;
    let retryFetchStub: SinonStub;
    let getBinaryPathStub: SinonStub;
    let getMatchedDriverVersionStub: SinonStub;
    let installBinaryStub: SinonStub;
    let getBrowserPlatformStub: SinonStub;
    let pipelineStub: SinonStub;
    let execFileStub: SinonStub;
    let unzipFileStub: SinonStub;
    let removeStub: SinonStub;
    let chmodStub: SinonStub;

    beforeEach(() => {
        downloadGeckoDriverStub = sandbox.stub().resolves("/binary/path");
        retryFetchStub = sandbox.stub().resolves("result");
        getBinaryPathStub = sandbox.stub().resolves("/binary/path");
        getMatchedDriverVersionStub = sandbox.stub().returns(null);
        installBinaryStub = sandbox.stub();
        getBrowserPlatformStub = sandbox.stub().returns(BrowserPlatform.LINUX);
        pipelineStub = sandbox.stub().resolves();
        execFileStub = sandbox.stub().callsFake((_command, _args, callback) => callback(null, "", ""));
        unzipFileStub = sandbox.stub().resolves();
        removeStub = sandbox.stub().resolves();
        chmodStub = sandbox.stub().resolves();

        installLatestGeckoDriver = proxyquire("../../../../src/browser-installer/firefox/driver", {
            geckodriver: { download: downloadGeckoDriverStub },
            "stream/promises": { pipeline: pipelineStub },
            child_process: { execFile: execFileStub }, // eslint-disable-line camelcase
            "fs-extra": {
                ensureDir: sandbox.stub().resolves(),
                mkdtemp: sandbox.stub().resolves("/download/dir"),
                createWriteStream: sandbox.stub().returns({}),
                chmod: chmodStub,
                remove: removeStub,
            },
            "../utils": {
                ...require("../../../../src/browser-installer/utils"),
                retryFetch: retryFetchStub,
                getBrowserPlatform: getBrowserPlatformStub,
                getGeckoDriverDir: sandbox.stub().returns("/driver/dir"),
                unzipFile: unzipFileStub,
            },
            "../registry": {
                default: {
                    getBinaryPath: getBinaryPathStub,
                    getMatchedDriverVersion: getMatchedDriverVersionStub,
                    installBinary: installBinaryStub,
                },
            },
        }).installLatestGeckoDriver;
    });

    afterEach(() => sandbox.restore());

    it("should try to resolve driver path locally by default", async () => {
        getMatchedDriverVersionStub.withArgs(DriverName.GECKODRIVER, sinon.match.string, "115").returns("115.0");
        getBinaryPathStub.withArgs(DriverName.GECKODRIVER, sinon.match.string, "115.0").returns("/driver/path");

        const driverPath = await installLatestGeckoDriver("115");

        assert.equal(driverPath, "/driver/path");
        assert.notCalled(retryFetchStub);
        assert.notCalled(installBinaryStub);
    });

    it("should not try to resolve driver path locally with 'force' flag", async () => {
        getMatchedDriverVersionStub.withArgs(DriverName.GECKODRIVER, sinon.match.string, "115").returns("115.0");
        retryFetchStub.withArgs("https://raw.githubusercontent.com/mozilla/geckodriver/release/Cargo.toml").resolves({
            ok: true,
            text: () => Promise.resolve("version = '0.35.0'"),
        });
        installBinaryStub
            .withArgs(DriverName.GECKODRIVER, sinon.match.string, "0.35.0", sinon.match.func)
            .resolves("/new/downloaded/driver/path");

        const driverPath = await installLatestGeckoDriver("115", { force: true });

        assert.notCalled(getBinaryPathStub);
        assert.equal(driverPath, "/new/downloaded/driver/path");
    });

    it("should download driver if it is not downloaded", async () => {
        getMatchedDriverVersionStub.withArgs(DriverName.GECKODRIVER, sinon.match.string, "115").returns(null);
        retryFetchStub.withArgs("https://raw.githubusercontent.com/mozilla/geckodriver/release/Cargo.toml").resolves({
            ok: true,
            text: () => Promise.resolve("version = '0.35.0'"),
        });
        installBinaryStub
            .withArgs(DriverName.GECKODRIVER, sinon.match.string, "0.35.0", sinon.match.func)
            .resolves("/new/downloaded/driver/path");

        const driverPath = await installLatestGeckoDriver("115");

        assert.equal(driverPath, "/new/downloaded/driver/path");
    });

    it("should keep the upstream downloader when only a Firefox mirror is set", async () => {
        retryFetchStub.resolves(new Response('version = "0.35.0"'));
        installBinaryStub.callsFake((_name, _platform, _version, installFn) => installFn());

        await installLatestGeckoDriver("115", {
            browserDownloadMirrors: { ...browserDownloadMirrors, geckodriver: null },
        });

        assert.calledOnceWithExactly(
            retryFetchStub,
            "https://raw.githubusercontent.com/mozilla/geckodriver/release/Cargo.toml",
        );
        assert.calledOnceWithExactly(downloadGeckoDriverStub, "0.35.0", "/driver/dir");
    });

    it("should reuse an installed driver without accessing the mirror", async () => {
        getMatchedDriverVersionStub.returns("0.35.0");

        await installLatestGeckoDriver("115", { browserDownloadMirrors });

        assert.notCalled(retryFetchStub);
        assert.notCalled(downloadGeckoDriverStub);
    });

    [
        [BrowserPlatform.LINUX, "linux64", ".tar.gz"],
        [BrowserPlatform.LINUX_ARM, "linux-aarch64", ".tar.gz"],
        [BrowserPlatform.MAC, "macos", ".tar.gz"],
        [BrowserPlatform.MAC_ARM, "macos-aarch64", ".tar.gz"],
        [BrowserPlatform.WIN32, "win32", ".zip"],
        [BrowserPlatform.WIN64, "win64", ".zip"],
    ].forEach(([platform, archivePlatform, extension]) => {
        it(`should download metadata and archive from the same mirror for ${platform}`, async () => {
            getBrowserPlatformStub.returns(platform);
            retryFetchStub.resolves(new Response("archive"));
            retryFetchStub
                .withArgs(`${browserDownloadMirrors.geckodriver}/Cargo.toml`)
                .resolves(
                    new Response('[package]\r\nversion = "0.37.1"\r\n[dependencies.helper]\r\nversion = "1.2.3"\r\n'),
                );
            installBinaryStub.callsFake((_name, _platform, _version, installFn) => installFn());

            const driverPath = await installLatestGeckoDriver("115", { browserDownloadMirrors });

            const filename = `geckodriver-v0.37.1-${archivePlatform}${extension}`;
            assert.calledWithExactly(retryFetchStub, `${browserDownloadMirrors.geckodriver}/v0.37.1/${filename}`);
            assert.callCount(retryFetchStub, 2);
            assert.calledOnce(pipelineStub);
            assert.calledOnceWithExactly(removeStub, "/download/dir");
            assert.calledOnceWithExactly(chmodStub, driverPath, 0o755);
            assert.notCalled(downloadGeckoDriverStub);

            if (extension === ".zip") {
                assert.equal(driverPath, "/driver/dir/geckodriver.exe");
                assert.calledOnceWithExactly(unzipFileStub, `/download/dir/${filename}`, "/driver/dir");
                assert.notCalled(execFileStub);
            } else {
                assert.equal(driverPath, "/driver/dir/geckodriver");
                assert.calledOnceWith(execFileStub, "tar", ["-xzf", `/download/dir/${filename}`, "-C", "/driver/dir"]);
                assert.notCalled(unzipFileStub);
            }
        });
    });

    [
        "",
        'version = ""',
        'version = "../other"',
        'version = "not-a-version"',
        '[package]\nversion = "invalid"\n[dependencies.helper]\nversion = "0.37.1"',
    ].forEach(toml => {
        it(`should reject malformed mirror metadata ${JSON.stringify(toml)} without upstream fallback`, async () => {
            retryFetchStub.resolves(new Response(toml));

            await assert.isRejected(
                installLatestGeckoDriver("115", { browserDownloadMirrors }),
                "Couldn't resolve latest geckodriver version",
            );

            assert.calledOnceWithExactly(retryFetchStub, `${browserDownloadMirrors.geckodriver}/Cargo.toml`);
            assert.notCalled(installBinaryStub);
            assert.notCalled(downloadGeckoDriverStub);
        });
    });

    it("should reject an HTTP error in metadata even if its body contains a version", async () => {
        retryFetchStub.resolves(new Response('version = "0.37.1"', { status: 404 }));

        await assert.isRejected(installLatestGeckoDriver("115", { browserDownloadMirrors }), "404");

        assert.notCalled(installBinaryStub);
    });

    it("should preserve network errors without trying the upstream", async () => {
        const error = new Error("network unavailable");
        retryFetchStub.rejects(error);

        assert.strictEqual(
            await installLatestGeckoDriver("115", { browserDownloadMirrors }).catch(error => error),
            error,
        );
        assert.calledOnceWithExactly(retryFetchStub, `${browserDownloadMirrors.geckodriver}/Cargo.toml`);
        assert.notCalled(downloadGeckoDriverStub);
    });

    it("should reject missing mirror archives without trying the upstream", async () => {
        retryFetchStub.resolves(new Response("not found", { status: 404 }));
        retryFetchStub
            .withArgs(`${browserDownloadMirrors.geckodriver}/Cargo.toml`)
            .resolves(new Response('version = "0.37.1"'));
        installBinaryStub.callsFake((_name, _platform, _version, installFn) => installFn());

        await assert.isRejected(
            installLatestGeckoDriver("115", { browserDownloadMirrors }),
            "Unable to download geckodriver",
        );

        assert.callCount(retryFetchStub, 2);
        assert.notCalled(pipelineStub);
        assert.notCalled(downloadGeckoDriverStub);
    });

    it("should remove temporary archives when extraction fails", async () => {
        retryFetchStub.callsFake(() => Promise.resolve(new Response('version = "0.37.1"')));
        installBinaryStub.callsFake((_name, _platform, _version, installFn) => installFn());
        execFileStub.callsFake((_command, _args, callback) => callback(new Error("bad archive")));

        await assert.isRejected(installLatestGeckoDriver("115", { browserDownloadMirrors }), "bad archive");

        assert.calledOnceWithExactly(removeStub, "/download/dir");
        assert.notCalled(chmodStub);
        assert.notCalled(downloadGeckoDriverStub);
    });
});
