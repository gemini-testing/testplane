import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type {
    installBrowser as InstallBrowser,
    installBrowsersWithDrivers as InstallBrowsersWithDrivers,
} from "../../../src/browser-installer/install";
import { BrowserName } from "../../../src/browser/types";

describe("browser-installer/install", () => {
    const sandbox = sinon.createSandbox();
    const browserDownloadMirrors = {
        chrome: "https://mirror.example/chrome",
        chromium: "https://mirror.example/chromium",
        firefox: "https://mirror.example/firefox",
    };

    let installBrowser: typeof InstallBrowser;
    let installBrowsersWithDrivers: typeof InstallBrowsersWithDrivers;

    let installChromeStub: SinonStub;
    let installChromeDriverStub: SinonStub;
    let resolveLatestChromeVersionStub: SinonStub;
    let installFirefoxStub: SinonStub;
    let installLatestGeckoDriverStub: SinonStub;
    let resolveLatestFirefoxVersionStub: SinonStub;
    let installEdgeDriverStub: SinonStub;
    let resolveEdgeVersionStub: SinonStub;

    let isUbuntuStub: SinonStub;
    let installUbuntuPackageDependenciesStub: SinonStub;

    beforeEach(() => {
        installChromeStub = sandbox.stub();
        installChromeDriverStub = sandbox.stub();
        resolveLatestChromeVersionStub = sandbox.stub();
        installFirefoxStub = sandbox.stub();
        installLatestGeckoDriverStub = sandbox.stub();
        resolveLatestFirefoxVersionStub = sandbox.stub();
        installEdgeDriverStub = sandbox.stub();
        resolveEdgeVersionStub = sandbox.stub();

        isUbuntuStub = sandbox.stub().resolves(false);
        installUbuntuPackageDependenciesStub = sandbox.stub().resolves();

        const installer = proxyquire("../../../src/browser-installer/install", {
            "./chrome": {
                installChrome: installChromeStub,
                installChromeDriver: installChromeDriverStub,
                resolveLatestChromeVersion: resolveLatestChromeVersionStub,
            },
            "./edge": { installEdgeDriver: installEdgeDriverStub, resolveEdgeVersion: resolveEdgeVersionStub },
            "./firefox": {
                installFirefox: installFirefoxStub,
                installLatestGeckoDriver: installLatestGeckoDriverStub,
                resolveLatestFirefoxVersion: resolveLatestFirefoxVersionStub,
            },
            "./ubuntu-packages": {
                isUbuntu: isUbuntuStub,
                installUbuntuPackageDependencies: installUbuntuPackageDependenciesStub,
            },
        });

        installBrowser = installer.installBrowser;
        installBrowsersWithDrivers = installer.installBrowsersWithDrivers;
    });

    afterEach(() => sandbox.restore());

    describe(`installBrowser`, () => {
        describe("browser version normalization", () => {
            const installOptions = {
                force: false,
                needUbuntuPackages: false,
                needWebDriver: false,
                browserDownloadMirrors,
            };

            it("should append .0 to digit-only versions for Chrome browser variants", async () => {
                await installBrowser(BrowserName.CHROME, "139", { browserDownloadMirrors });
                await installBrowser(BrowserName.CHROMIUM, "144", { browserDownloadMirrors });
                await installBrowser(BrowserName.CHROMEHEADLESSSHELL, "145", { browserDownloadMirrors });

                assert.calledWithExactly(installChromeStub, BrowserName.CHROME, "139.0", installOptions);
                assert.calledWithExactly(installChromeStub, BrowserName.CHROME, "144.0", installOptions);
                assert.calledWithExactly(installChromeStub, BrowserName.CHROMEHEADLESSSHELL, "145.0", installOptions);
            });

            it("should append .0 to a digit-only Firefox version", async () => {
                await installBrowser(BrowserName.FIREFOX, "144", { browserDownloadMirrors });

                assert.calledOnceWithExactly(installFirefoxStub, "144.0", installOptions);
            });

            it("should append .0 to a digit-only Edge version", async () => {
                await installBrowser(BrowserName.EDGE, "139", { shouldInstallWebDriver: true });

                assert.calledOnceWithExactly(installEdgeDriverStub, "139.0", { force: false });
            });

            ["139.0", "139.0.7258.1", "stable", "beta", "dev", "canary", "latest"].forEach(version => {
                it(`should preserve supplied Chrome selector ${version}`, async () => {
                    await installBrowser(BrowserName.CHROME, version, { browserDownloadMirrors });

                    assert.calledOnceWithExactly(installChromeStub, BrowserName.CHROME, version, installOptions);
                });
            });

            it("should preserve a version resolved for an omitted Chrome version", async () => {
                resolveLatestChromeVersionStub.resolves("139");

                await installBrowser(BrowserName.CHROME, undefined, { browserDownloadMirrors });

                assert.calledOnceWithExactly(resolveLatestChromeVersionStub, false, browserDownloadMirrors);
                assert.calledOnceWithExactly(installChromeStub, BrowserName.CHROME, "139", installOptions);
            });

            it("should preserve a version resolved for an omitted Edge version", async () => {
                resolveEdgeVersionStub.resolves("139");

                await installBrowser(BrowserName.EDGE, undefined, { shouldInstallWebDriver: true });

                assert.calledOnceWithExactly(resolveEdgeVersionStub);
                assert.calledOnceWithExactly(installEdgeDriverStub, "139", { force: false });
            });
        });

        [true, false].forEach(force => {
            describe(`force: ${force}`, () => {
                describe("chrome", () => {
                    it("should install browser", async () => {
                        installChromeStub.withArgs("chrome", "115.0").resolves("/browser/path");

                        const binaryPath = await installBrowser(BrowserName.CHROME, "115", { force });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installChromeStub, "chrome", "115.0", {
                            force,
                            needUbuntuPackages: false,
                            needWebDriver: false,
                            browserDownloadMirrors: undefined,
                        });
                    });

                    it("should install browser with webdriver", async () => {
                        installChromeStub.withArgs("chrome", "115.0").resolves("/browser/path");

                        const binaryPath = await installBrowser(BrowserName.CHROME, "115", {
                            force,
                            shouldInstallWebDriver: true,
                        });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installChromeStub, "chrome", "115.0", {
                            force,
                            needUbuntuPackages: false,
                            needWebDriver: true,
                            browserDownloadMirrors: undefined,
                        });
                    });

                    it("should pass browser download mirrors", async () => {
                        await installBrowser(BrowserName.CHROME, "115", { force, browserDownloadMirrors });

                        assert.calledOnceWith(installChromeStub, "chrome", "115.0", {
                            force,
                            needUbuntuPackages: false,
                            needWebDriver: false,
                            browserDownloadMirrors,
                        });
                    });

                    it("should pass browser download mirrors when resolving an omitted version", async () => {
                        resolveLatestChromeVersionStub.resolves("stable-chrome");

                        await installBrowser(BrowserName.CHROME, undefined, { force, browserDownloadMirrors });

                        assert.calledOnceWithExactly(resolveLatestChromeVersionStub, force, browserDownloadMirrors);
                        assert.calledOnceWith(installChromeStub, "chrome", "stable-chrome", {
                            force,
                            needUbuntuPackages: false,
                            needWebDriver: false,
                            browserDownloadMirrors,
                        });
                    });
                });

                describe("firefox", () => {
                    it("should install browser", async () => {
                        installFirefoxStub.withArgs("115.0").resolves("/browser/path");

                        const binaryPath = await installBrowser(BrowserName.FIREFOX, "115", { force });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installFirefoxStub, "115.0", {
                            force,
                            needUbuntuPackages: false,
                            needWebDriver: false,
                            browserDownloadMirrors: undefined,
                        });
                    });

                    it("should install browser with webdriver", async () => {
                        installFirefoxStub.withArgs("115.0").resolves("/browser/path");

                        const binaryPath = await installBrowser(BrowserName.FIREFOX, "115", {
                            force,
                            shouldInstallWebDriver: true,
                        });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installFirefoxStub, "115.0", {
                            force,
                            needUbuntuPackages: false,
                            needWebDriver: true,
                            browserDownloadMirrors: undefined,
                        });
                    });

                    it("should pass browser download mirrors when resolving an omitted version", async () => {
                        resolveLatestFirefoxVersionStub.resolves("stable-firefox");

                        await installBrowser(BrowserName.FIREFOX, undefined, { force, browserDownloadMirrors });

                        assert.calledOnceWithExactly(resolveLatestFirefoxVersionStub, force, browserDownloadMirrors);
                        assert.calledOnceWith(installFirefoxStub, "stable-firefox", {
                            force,
                            needUbuntuPackages: false,
                            needWebDriver: false,
                            browserDownloadMirrors,
                        });
                    });
                });

                describe("edge", () => {
                    it("should return null", async () => {
                        const binaryPath = await installBrowser("MicrosoftEdge", "115", { force });

                        assert.equal(binaryPath, null);
                        assert.notCalled(installEdgeDriverStub);
                    });

                    it("should install webdriver", async () => {
                        const binaryPath = await installBrowser("MicrosoftEdge", "115", {
                            force,
                            shouldInstallWebDriver: true,
                        });

                        assert.equal(binaryPath, null);
                        assert.calledOnceWith(installEdgeDriverStub, "115.0", { force });
                    });
                });

                describe("safari", () => {
                    it("should return null", async () => {
                        const binaryPath = await installBrowser("safari", "115", {
                            force,
                            shouldInstallWebDriver: true,
                        });

                        assert.equal(binaryPath, null);
                    });
                });
            });
        });
    });

    describe("installBrowsersWithDrivers", () => {
        it("should normalize installation while keeping the requested version in the result key", async () => {
            installChromeStub.resolves("/browser/path");

            const result = await installBrowsersWithDrivers([{ browserName: "chrome", browserVersion: "139" }], {
                browserDownloadMirrors,
            });

            assert.calledOnceWithExactly(installChromeStub, BrowserName.CHROME, "139.0", {
                force: true,
                needUbuntuPackages: false,
                needWebDriver: true,
                browserDownloadMirrors,
            });
            assert.deepEqual(result, { "chrome@139": { status: "ok" } });
        });

        it("should force install browser with driver", async () => {
            await installBrowsersWithDrivers([{ browserName: "chrome", browserVersion: "115" }]);

            assert.calledOnceWith(installChromeStub, "chrome", "115.0", {
                force: true,
                needUbuntuPackages: false,
                needWebDriver: true,
                browserDownloadMirrors: undefined,
            });
        });

        it("should pass browser download mirrors", async () => {
            await installBrowsersWithDrivers([{ browserName: "chrome", browserVersion: "115" }], {
                browserDownloadMirrors,
            });

            assert.calledOnceWith(installChromeStub, "chrome", "115.0", {
                force: true,
                needUbuntuPackages: false,
                needWebDriver: true,
                browserDownloadMirrors,
            });
        });

        it("should install ubuntu packages on ubuntu", async () => {
            isUbuntuStub.resolves(true);

            await installBrowsersWithDrivers([{ browserName: "chrome", browserVersion: "115" }]);

            assert.calledOnceWith(installChromeStub, "chrome", "115.0", {
                force: true,
                needWebDriver: true,
                needUbuntuPackages: true,
                browserDownloadMirrors: undefined,
            });
        });

        it("should not install ubuntu packages if its not ubuntu", async () => {
            isUbuntuStub.resolves(false);

            await installBrowsersWithDrivers([{ browserName: "chrome", browserVersion: "115" }]);

            assert.notCalled(installUbuntuPackageDependenciesStub);
        });

        it("should return result with browsers install status", async () => {
            installChromeStub.rejects(new Error("test chrome install error"));
            installFirefoxStub.resolves("/browser/path");

            const result = await installBrowsersWithDrivers([
                { browserName: "chrome", browserVersion: "115" },
                { browserName: "firefox", browserVersion: "120" },
                { browserName: "edge", browserVersion: "125" },
            ]);

            assert.deepEqual(result, {
                "chrome@115": { status: "error", reason: "test chrome install error" },
                "firefox@120": { status: "ok" },
                "edge@125": {
                    status: "skip",
                    reason: "Installing edge is unsupported. Assuming it is installed locally",
                },
            });
        });
    });
});
