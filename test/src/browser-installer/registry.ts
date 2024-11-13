import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type * as Registry from "../../../src/browser-installer/registry";
import { Browser, Driver, type DownloadProgressCallback } from "../../../src/browser-installer/utils";
import { BrowserPlatform } from "@puppeteer/browsers";

describe("browser-installer/registry", () => {
    const sandbox = sinon.createSandbox();

    let registry: typeof Registry;

    let readJsonSyncStub: SinonStub;
    let outputJSONSyncStub: SinonStub;
    let existsSyncStub: SinonStub;
    let progressBarRegisterStub: SinonStub;
    let loggerWarnStub: SinonStub;

    const createRegisry_ = (contents: Record<string, Record<string, string>> = {}): typeof Registry => {
        return proxyquire("../../../src/browser-installer/registry", {
            "../utils": { getRegistryPath: () => "/testplane/registry/registry.json" },
            "fs-extra": { readJsonSync: () => contents, existsSync: () => true },
            "../../utils/logger": { warn: loggerWarnStub },
        });
    };

    beforeEach(() => {
        readJsonSyncStub = sandbox.stub().returns({});
        outputJSONSyncStub = sandbox.stub();
        existsSyncStub = sandbox.stub().returns(false);
        progressBarRegisterStub = sandbox.stub();
        loggerWarnStub = sandbox.stub();

        registry = proxyquire("../../../src/browser-installer/registry", {
            "./cli-progress-bar": { createBrowserDownloadProgressBar: () => ({ register: progressBarRegisterStub }) },
            "../utils": { getRegistryPath: () => "/testplane/registry/registry.json" },
            "../../utils/logger": { warn: loggerWarnStub },
            "fs-extra": {
                readJsonSync: readJsonSyncStub,
                outputJSONSync: outputJSONSyncStub,
                existsSync: existsSyncStub,
            },
        });
    });

    afterEach(() => sandbox.restore());

    describe("getBinaryPath", () => {
        it("should return binary path", async () => {
            registry = createRegisry_({
                // eslint-disable-next-line camelcase
                chrome_mac_arm: {
                    "115.0.5790.170": "../browsers/chrome",
                },
            });

            const result = await registry.getBinaryPath(Browser.CHROME, BrowserPlatform.MAC_ARM, "115.0.5790.170");

            assert.equal(result, "/testplane/registry/browsers/chrome");
        });

        it("should throw an error if browser is not installed", async () => {
            registry = createRegisry_({});

            const fn = (): Promise<string> => registry.getBinaryPath(Browser.CHROME, BrowserPlatform.MAC_ARM, "115");

            await assert.isRejected(fn(), "Binary 'chrome' on 'mac_arm' is not installed");
        });

        it("should throw an error if browser version is not installed", async () => {
            // eslint-disable-next-line camelcase
            registry = createRegisry_({ chrome_mac_arm: {} });

            const fn = (): Promise<string> => registry.getBinaryPath(Browser.CHROME, BrowserPlatform.MAC_ARM, "120");

            await assert.isRejected(fn(), "Version '120' of driver 'chrome' on 'mac_arm' is not installed");
        });
    });

    describe("getMatchingBrowserVersion", () => {
        it("should return matching latest chrome browser version", () => {
            registry = createRegisry_({
                // eslint-disable-next-line camelcase
                chrome_mac_arm: {
                    "115.0.5790.170": "../browsers/chrome-115-0-5790-170",
                    "114.0.6980.170": "../browsers/chrome-114-0-6980-170",
                    "115.0.5320.180": "../browsers/chrome-115-0-5230-180",
                },
            });

            const version = registry.getMatchingBrowserVersion(Browser.CHROME, BrowserPlatform.MAC_ARM, "115");
            const versionFull = registry.getMatchingBrowserVersion(Browser.CHROME, BrowserPlatform.MAC_ARM, "115.0");

            assert.equal(version, "115.0.5790.170");
            assert.equal(versionFull, "115.0.5790.170");
        });

        it("should return matching latest firefox browser version", () => {
            registry = createRegisry_({
                // eslint-disable-next-line camelcase
                firefox_mac_arm: {
                    "stable_117.0b2": "../browsers/chrome-117-0b2",
                    "stable_118.0": "../browsers/firefox-118-0",
                    "stable_117.0b9": "../browsers/firefox-117-0b9",
                },
            });

            const version = registry.getMatchingBrowserVersion(Browser.FIREFOX, BrowserPlatform.MAC_ARM, "117");
            const versionFull = registry.getMatchingBrowserVersion(Browser.FIREFOX, BrowserPlatform.MAC_ARM, "117.0");

            assert.equal(version, "stable_117.0b9");
            assert.equal(versionFull, "stable_117.0b9");
        });

        it("should return null if no installed browser matching requirements", () => {
            registry = createRegisry_({
                // eslint-disable-next-line camelcase
                chrome_mac_arm: {
                    "115.0.5790.170": "../browsers/chrome-115-0-5790-170",
                    "114.0.6980.170": "../browsers/chrome-114-0-6980-170",
                    "115.0.5320.180": "../browsers/chrome-115-0-5230-180",
                },
            });

            const version = registry.getMatchingBrowserVersion(Browser.CHROME, BrowserPlatform.MAC_ARM, "116");
            const versionFull = registry.getMatchingBrowserVersion(Browser.CHROME, BrowserPlatform.MAC_ARM, "116.0");

            assert.equal(version, null);
            assert.equal(versionFull, null);
        });
    });

    describe("getMatchingDriverVersion", () => {
        it("should return matching chromedriver version", () => {
            registry = createRegisry_({
                // eslint-disable-next-line camelcase
                chromedriver_mac_arm: {
                    "115.0.5790.170": "../drivers/chromedriver-115-0-5790-170",
                    "114.0.6980.170": "../drivers/chromedriver-114-0-6980-170",
                    "115.0.5320.180": "../drivers/chromedriver-115-0-5230-180",
                },
            });

            const version = registry.getMatchingDriverVersion(Driver.CHROMEDRIVER, BrowserPlatform.MAC_ARM, "115");
            const versionFull = registry.getMatchingDriverVersion(
                Driver.CHROMEDRIVER,
                BrowserPlatform.MAC_ARM,
                "115.0",
            );

            assert.equal(version, "115.0.5790.170");
            assert.equal(versionFull, "115.0.5790.170");
        });

        it("should return matching chromedriver version", () => {
            registry = createRegisry_({
                // eslint-disable-next-line camelcase
                edgedriver_mac_arm: {
                    "115.0.5790.170": "../drivers/edgedriver-115-0-5790-170",
                    "114.0.6980.170": "../drivers/edgedriver-114-0-6980-170",
                    "115.0.5320.180": "../drivers/edgedriver-115-0-5230-180",
                },
            });

            const version = registry.getMatchingDriverVersion(Driver.EDGEDRIVER, BrowserPlatform.MAC_ARM, "115");
            const versionFull = registry.getMatchingDriverVersion(Driver.EDGEDRIVER, BrowserPlatform.MAC_ARM, "115.0");

            assert.equal(version, "115.0.5790.170");
            assert.equal(versionFull, "115.0.5790.170");
        });

        it("should return latest version for geckodriver", () => {
            registry = createRegisry_({
                // eslint-disable-next-line camelcase
                geckodriver_mac_arm: {
                    "0.33.0": "../drivers/geckodriver-33",
                    "0.35.0": "../drivers/geckodriver-35",
                    "0.34.0": "../drivers/geckodriver-34",
                },
            });

            const version = registry.getMatchingDriverVersion(Driver.GECKODRIVER, BrowserPlatform.MAC_ARM, "115");
            const versionFull = registry.getMatchingDriverVersion(Driver.GECKODRIVER, BrowserPlatform.MAC_ARM, "115.0");

            assert.equal(version, "0.35.0");
            assert.equal(versionFull, "0.35.0");
        });

        it("should return null if matching version is not found", () => {
            registry = createRegisry_({
                // eslint-disable-next-line camelcase
                chromedriver_mac_arm: {},
            });

            const version = registry.getMatchingDriverVersion(Driver.GECKODRIVER, BrowserPlatform.MAC_ARM, "115");
            const versionFull = registry.getMatchingDriverVersion(Driver.GECKODRIVER, BrowserPlatform.MAC_ARM, "115.0");

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
            registry = createRegisry_({
                // eslint-disable-next-line camelcase
                chrome_mac_arm: {
                    "115.0.5320.180": "../browser/path",
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
                    // eslint-disable-next-line camelcase
                    chrome_mac_arm: { "115.0.5320.180": "../browser/path" },
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
