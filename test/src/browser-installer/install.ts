import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type {
    installBrowser as InstallBrowser,
    installBrowsersWithDrivers as InstallBrowsersWithDrivers,
} from "../../../src/browser-installer/install";
import { Browser } from "../../../src/browser-installer/utils";

describe("browser-installer/install", () => {
    const sandbox = sinon.createSandbox();

    let installBrowser: typeof InstallBrowser;
    let installBrowsersWithDrivers: typeof InstallBrowsersWithDrivers;

    let installChromeStub: SinonStub;
    let installChromeDriverStub: SinonStub;
    let installFirefoxStub: SinonStub;
    let installLatestGeckoDriverStub: SinonStub;
    let installEdgeDriverStub: SinonStub;

    let isUbuntuStub: SinonStub;
    let installUbuntuPackageDependenciesStub: SinonStub;

    beforeEach(() => {
        installChromeStub = sandbox.stub();
        installChromeDriverStub = sandbox.stub();
        installFirefoxStub = sandbox.stub();
        installLatestGeckoDriverStub = sandbox.stub();
        installEdgeDriverStub = sandbox.stub();

        isUbuntuStub = sandbox.stub().resolves(false);
        installUbuntuPackageDependenciesStub = sandbox.stub().resolves();

        const installer = proxyquire("../../../src/browser-installer/install", {
            "./chrome": { installChrome: installChromeStub, installChromeDriver: installChromeDriverStub },
            "./edge": { installEdgeDriver: installEdgeDriverStub },
            "./firefox": { installFirefox: installFirefoxStub, installLatestGeckoDriver: installLatestGeckoDriverStub },
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
                        installChromeStub.withArgs("115").resolves("/browser/path");

                        const binaryPath = await installBrowser(Browser.CHROME, "115", { force });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installChromeStub, "115", { force });
                        assert.notCalled(installChromeDriverStub);
                    });

                    it("should install browser with webdriver", async () => {
                        installChromeStub.withArgs("115").resolves("/browser/path");

                        const binaryPath = await installBrowser(Browser.CHROME, "115", {
                            force,
                            shouldInstallWebDriver: true,
                        });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installChromeStub, "115", { force });
                        assert.calledOnceWith(installChromeDriverStub, "115", { force });
                    });
                });

                describe("firefox", () => {
                    it("should install browser", async () => {
                        installFirefoxStub.withArgs("115").resolves("/browser/path");

                        const binaryPath = await installBrowser(Browser.FIREFOX, "115", { force });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installFirefoxStub, "115", { force });
                        assert.notCalled(installLatestGeckoDriverStub);
                    });

                    it("should install browser with webdriver", async () => {
                        installFirefoxStub.withArgs("115").resolves("/browser/path");

                        const binaryPath = await installBrowser(Browser.FIREFOX, "115", {
                            force,
                            shouldInstallWebDriver: true,
                        });

                        assert.equal(binaryPath, "/browser/path");
                        assert.calledOnceWith(installFirefoxStub, "115", { force });
                        assert.calledOnceWith(installLatestGeckoDriverStub, "115", { force });
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

                it("should throw exception on empty browser version", async () => {
                    await assert.isRejected(
                        installBrowser(Browser.CHROME, "", { force }),
                        /Couldn't install browser 'chrome' because it has invalid version: ''/,
                    );
                });
            });
        });

        [Browser.CHROME, Browser.FIREFOX].forEach(browser => {
            it(`should not install ubuntu dependencies by default for ${browser}`, async () => {
                isUbuntuStub.resolves(true);

                await installBrowser(browser, "115");

                assert.notCalled(installUbuntuPackageDependenciesStub);
            });

            it(`should not install ubuntu dependencies if its not ubuntu for ${browser}`, async () => {
                isUbuntuStub.resolves(false);

                await installBrowser(browser, "115", { shouldInstallUbuntuPackages: true });

                assert.notCalled(installUbuntuPackageDependenciesStub);
            });

            it(`should install ubuntu dependencies if its ubuntu for ${browser}`, async () => {
                isUbuntuStub.resolves(true);

                await installBrowser(browser, "115", { shouldInstallUbuntuPackages: true });

                assert.calledOnce(installUbuntuPackageDependenciesStub);
            });
        });
    });

    describe("installBrowsersWithDrivers", () => {
        it("should force install browser with driver", async () => {
            await installBrowsersWithDrivers([{ browserName: "chrome", browserVersion: "115" }]);

            assert.calledOnceWith(installChromeStub, "115", { force: true });
            assert.calledOnceWith(installChromeDriverStub, "115", { force: true });
        });

        it("should install ubuntu packages on ubuntu", async () => {
            isUbuntuStub.resolves(true);

            await installBrowsersWithDrivers([{ browserName: "chrome", browserVersion: "115" }]);

            assert.calledOnceWith(installUbuntuPackageDependenciesStub);
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
