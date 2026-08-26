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

        isUbuntuStub = sandbox.stub().resolves(false);
        installUbuntuPackageDependenciesStub = sandbox.stub().resolves();

        const installer = proxyquire("../../../src/browser-installer/install", {
            "./chrome": {
                installChrome: installChromeStub,
                installChromeDriver: installChromeDriverStub,
                resolveLatestChromeVersion: resolveLatestChromeVersionStub,
            },
            "./edge": { installEdgeDriver: installEdgeDriverStub },
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
        [true, false].forEach(force => {
            describe(`force: ${force}`, () => {
                describe("chrome", () => {
                    it("should install browser", async () => {
                        installChromeStub.withArgs("chrome", "115").resolves("/browser/path");

                        const binaryPath = await installBrowser(BrowserName.CHROME, "115", { force });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installChromeStub, "chrome", "115", {
                            force,
                            needUbuntuPackages: false,
                            needWebDriver: false,
                        });
                    });

                    it("should install browser with webdriver", async () => {
                        installChromeStub.withArgs("chrome", "115").resolves("/browser/path");

                        const binaryPath = await installBrowser(BrowserName.CHROME, "115", {
                            force,
                            shouldInstallWebDriver: true,
                        });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installChromeStub, "chrome", "115", {
                            force,
                            needUbuntuPackages: false,
                            needWebDriver: true,
                        });
                    });

                    it("should pass browser download mirrors", async () => {
                        await installBrowser(BrowserName.CHROME, "115", { force, browserDownloadMirrors });

                        assert.calledOnceWith(installChromeStub, "chrome", "115", {
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
                        installFirefoxStub.withArgs("115").resolves("/browser/path");

                        const binaryPath = await installBrowser(BrowserName.FIREFOX, "115", { force });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installFirefoxStub, "115", {
                            force,
                            needUbuntuPackages: false,
                            needWebDriver: false,
                        });
                    });

                    it("should install browser with webdriver", async () => {
                        installFirefoxStub.withArgs("115").resolves("/browser/path");

                        const binaryPath = await installBrowser(BrowserName.FIREFOX, "115", {
                            force,
                            shouldInstallWebDriver: true,
                        });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installFirefoxStub, "115", {
                            force,
                            needUbuntuPackages: false,
                            needWebDriver: true,
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
                        assert.calledOnceWith(installEdgeDriverStub, "115", { force });
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
        it("should force install browser with driver", async () => {
            await installBrowsersWithDrivers([{ browserName: "chrome", browserVersion: "115" }]);

            assert.calledOnceWith(installChromeStub, "chrome", "115", {
                force: true,
                needUbuntuPackages: false,
                needWebDriver: true,
            });
        });

        it("should pass browser download mirrors", async () => {
            await installBrowsersWithDrivers([{ browserName: "chrome", browserVersion: "115" }], {
                browserDownloadMirrors,
            });

            assert.calledOnceWith(installChromeStub, "chrome", "115", {
                force: true,
                needUbuntuPackages: false,
                needWebDriver: true,
                browserDownloadMirrors,
            });
        });

        it("should install ubuntu packages on ubuntu", async () => {
            isUbuntuStub.resolves(true);

            await installBrowsersWithDrivers([{ browserName: "chrome", browserVersion: "115" }]);

            assert.calledOnceWith(installChromeStub, "chrome", "115", {
                force: true,
                needWebDriver: true,
                needUbuntuPackages: true,
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
