import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type * as RegistryType from "../../../src/browser-installer/registry";
import { Browser, Driver, type DownloadProgressCallback, type Registry } from "../../../src/browser-installer/utils";
import { BrowserPlatform } from "@puppeteer/browsers";
import type { PartialDeep } from "type-fest";

describe("browser-installer/registry", () => {
    const sandbox = sinon.createSandbox();

    let registry: typeof RegistryType;

    let readRegistryStub: SinonStub;
    let outputJSONSyncStub: SinonStub;
    let progressBarRegisterStub: SinonStub;
    let loggerWarnStub: SinonStub;

    const createRegistry_ = (contents: PartialDeep<Registry> = {} as Registry): typeof RegistryType => {
        contents.binaries ||= {};
        contents.osPackages ||= {};
        contents.meta ||= { version: 1 };

        return proxyquire("../../../src/browser-installer/registry", {
            "../utils": { getRegistryPath: () => "/testplane/registry/registry.json", readRegistry: () => contents },
            "../../utils/logger": { warn: loggerWarnStub },
        });
    };

    beforeEach(() => {
        readRegistryStub = sandbox.stub().returns({ binaries: {}, osPackages: {}, meta: { version: 1 } });
        outputJSONSyncStub = sandbox.stub();
        progressBarRegisterStub = sandbox.stub();
        loggerWarnStub = sandbox.stub();

        registry = proxyquire("../../../src/browser-installer/registry", {
            "./cli-progress-bar": { createBrowserDownloadProgressBar: () => ({ register: progressBarRegisterStub }) },
            "../utils": { getRegistryPath: () => "/testplane/registry/registry.json", readRegistry: readRegistryStub },
            "../../utils/logger": { warn: loggerWarnStub },
            "fs-extra": { outputJSONSync: outputJSONSyncStub },
        });
    });

    afterEach(() => sandbox.restore());

    describe("getBinaryPath", () => {
        it("should return binary path", async () => {
            registry = createRegistry_({
                binaries: {
                    // eslint-disable-next-line camelcase
                    chrome_mac_arm: {
                        "115.0.5790.170": "../browsers/chrome",
                    },
                },
            });

            const result = await registry.getBinaryPath(Browser.CHROME, BrowserPlatform.MAC_ARM, "115.0.5790.170");

            assert.equal(result, "/testplane/registry/browsers/chrome");
        });

        it("should throw an error if browser is not installed", async () => {
            registry = createRegistry_({});

            const fn = (): Promise<string> => registry.getBinaryPath(Browser.CHROME, BrowserPlatform.MAC_ARM, "115");

            await assert.isRejected(fn(), "Binary 'chrome' on 'mac_arm' is not installed");
        });

        it("should throw an error if browser version is not installed", async () => {
            // eslint-disable-next-line camelcase
            registry = createRegistry_({ binaries: { chrome_mac_arm: {} } });

            const fn = (): Promise<string> => registry.getBinaryPath(Browser.CHROME, BrowserPlatform.MAC_ARM, "120");

            await assert.isRejected(fn(), "Version '120' of driver 'chrome' on 'mac_arm' is not installed");
        });
    });

    describe("getMatchedBrowserVersion", () => {
        it("should return matching latest chrome browser version", () => {
            registry = createRegistry_({
                binaries: {
                    // eslint-disable-next-line camelcase
                    chrome_mac_arm: {
                        "115.0.5790.170": "../browsers/chrome-115-0-5790-170",
                        "114.0.6980.170": "../browsers/chrome-114-0-6980-170",
                        "115.0.5320.180": "../browsers/chrome-115-0-5230-180",
                    },
                },
            });

            const version = registry.getMatchedBrowserVersion(Browser.CHROME, BrowserPlatform.MAC_ARM, "115");
            const versionFull = registry.getMatchedBrowserVersion(Browser.CHROME, BrowserPlatform.MAC_ARM, "115.0");

            assert.equal(version, "115.0.5790.170");
            assert.equal(versionFull, "115.0.5790.170");
        });

        it("should return matching latest firefox browser version", () => {
            registry = createRegistry_({
                binaries: {
                    // eslint-disable-next-line camelcase
                    firefox_mac_arm: {
                        "stable_117.0b2": "../browsers/chrome-117-0b2",
                        "stable_118.0": "../browsers/firefox-118-0",
                        "stable_117.0b9": "../browsers/firefox-117-0b9",
                    },
                },
            });

            const version = registry.getMatchedBrowserVersion(Browser.FIREFOX, BrowserPlatform.MAC_ARM, "117");
            const versionFull = registry.getMatchedBrowserVersion(Browser.FIREFOX, BrowserPlatform.MAC_ARM, "117.0");

            assert.equal(version, "stable_117.0b9");
            assert.equal(versionFull, "stable_117.0b9");
        });

        it("should return null if no installed browser matching requirements", () => {
            registry = createRegistry_({
                binaries: {
                    // eslint-disable-next-line camelcase
                    chrome_mac_arm: {
                        "115.0.5790.170": "../browsers/chrome-115-0-5790-170",
                        "114.0.6980.170": "../browsers/chrome-114-0-6980-170",
                        "115.0.5320.180": "../browsers/chrome-115-0-5230-180",
                    },
                },
            });

            const version = registry.getMatchedBrowserVersion(Browser.CHROME, BrowserPlatform.MAC_ARM, "116");
            const versionFull = registry.getMatchedBrowserVersion(Browser.CHROME, BrowserPlatform.MAC_ARM, "116.0");

            assert.equal(version, null);
            assert.equal(versionFull, null);
        });
    });

    describe("getMatchedDriverVersion", () => {
        it("should return matching chromedriver version", () => {
            registry = createRegistry_({
                binaries: {
                    // eslint-disable-next-line camelcase
                    chromedriver_mac_arm: {
                        "115.0.5790.170": "../drivers/chromedriver-115-0-5790-170",
                        "114.0.6980.170": "../drivers/chromedriver-114-0-6980-170",
                        "115.0.5320.180": "../drivers/chromedriver-115-0-5230-180",
                    },
                },
            });

            const version = registry.getMatchedDriverVersion(Driver.CHROMEDRIVER, BrowserPlatform.MAC_ARM, "115");
            const versionFull = registry.getMatchedDriverVersion(Driver.CHROMEDRIVER, BrowserPlatform.MAC_ARM, "115.0");

            assert.equal(version, "115.0.5790.170");
            assert.equal(versionFull, "115.0.5790.170");
        });

        it("should return matching chromedriver version", () => {
            registry = createRegistry_({
                binaries: {
                    // eslint-disable-next-line camelcase
                    edgedriver_mac_arm: {
                        "115.0.5790.170": "../drivers/edgedriver-115-0-5790-170",
                        "114.0.6980.170": "../drivers/edgedriver-114-0-6980-170",
                        "115.0.5320.180": "../drivers/edgedriver-115-0-5230-180",
                    },
                },
            });

            const version = registry.getMatchedDriverVersion(Driver.EDGEDRIVER, BrowserPlatform.MAC_ARM, "115");
            const versionFull = registry.getMatchedDriverVersion(Driver.EDGEDRIVER, BrowserPlatform.MAC_ARM, "115.0");

            assert.equal(version, "115.0.5790.170");
            assert.equal(versionFull, "115.0.5790.170");
        });

        it("should return latest version for geckodriver", () => {
            registry = createRegistry_({
                binaries: {
                    // eslint-disable-next-line camelcase
                    geckodriver_mac_arm: {
                        "0.33.0": "../drivers/geckodriver-33",
                        "0.35.0": "../drivers/geckodriver-35",
                        "0.34.0": "../drivers/geckodriver-34",
                    },
                },
            });

            const version = registry.getMatchedDriverVersion(Driver.GECKODRIVER, BrowserPlatform.MAC_ARM, "115");
            const versionFull = registry.getMatchedDriverVersion(Driver.GECKODRIVER, BrowserPlatform.MAC_ARM, "115.0");

            assert.equal(version, "0.35.0");
            assert.equal(versionFull, "0.35.0");
        });

        it("should return null if matching version is not found", () => {
            registry = createRegistry_({
                binaries: {
                    // eslint-disable-next-line camelcase
                    chromedriver_mac_arm: {},
                },
            });

            const version = registry.getMatchedDriverVersion(Driver.GECKODRIVER, BrowserPlatform.MAC_ARM, "115");
            const versionFull = registry.getMatchedDriverVersion(Driver.GECKODRIVER, BrowserPlatform.MAC_ARM, "115.0");

            assert.equal(version, null);
            assert.equal(versionFull, null);
        });
    });

    describe("installBinary", () => {
        it("should install binary and return its executable path", async () => {
            const result = await registry.installBinary(Browser.CHROME, BrowserPlatform.LINUX, "100.0.0.0", () =>
                Promise.resolve("/browser/path"),
            );

            assert.equal(result, "/browser/path");
        });

        it("should not install binary if it is already installed", async () => {
            registry = createRegistry_({
                binaries: {
                    // eslint-disable-next-line camelcase
                    chrome_mac_arm: {
                        "115.0.5320.180": "../browser/path",
                    },
                },
            });

            const installFn = sinon.stub().resolves("/another/browser/path");
            const result = await registry.installBinary(
                Browser.CHROME,
                BrowserPlatform.MAC_ARM,
                "115.0.5320.180",
                installFn,
            );

            assert.notCalled(installFn);
            assert.equal(result, "/testplane/registry/browser/path");
        });

        it("should save binary to registry after install", async () => {
            const installFn = sinon.stub().resolves("/testplane/registry/browser/path");
            await registry.installBinary(Browser.CHROME, BrowserPlatform.MAC_ARM, "115.0.5320.180", installFn);

            const savedPath = await registry.getBinaryPath(Browser.CHROME, BrowserPlatform.MAC_ARM, "115.0.5320.180");

            assert.equal(savedPath, "/testplane/registry/browser/path");
            assert.calledOnceWith(
                outputJSONSyncStub,
                "/testplane/registry/registry.json",
                {
                    binaries: {
                        // eslint-disable-next-line camelcase
                        chrome_mac_arm: { "115.0.5320.180": "../browser/path" },
                    },
                    osPackages: {},
                    meta: { version: 1 },
                },
                { replacer: sinon.match.func },
            );
        });

        it("should log warning once on install", async () => {
            progressBarRegisterStub.returns(sandbox.stub());

            const installFn = async (downloadProgressCallback: DownloadProgressCallback): Promise<string> => {
                downloadProgressCallback(0, 1024);

                return "/testplane/registry/browser/path";
            };

            await registry.installBinary(Browser.CHROME, BrowserPlatform.MAC_ARM, "115.0.5320.180", installFn);

            await registry.installBinary(Browser.FIREFOX, BrowserPlatform.MAC_ARM, "120.0.5320.180", installFn);

            assert.calledWith(loggerWarnStub, "Downloading Testplane browsers");
            assert.calledWith(loggerWarnStub, "Note: this is one-time action. It may take a while...");
            assert.calledTwice(loggerWarnStub);
        });
    });
});
