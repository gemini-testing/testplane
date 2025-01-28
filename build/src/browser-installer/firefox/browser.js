"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLatestFirefoxVersion = exports.installFirefox = void 0;
const lodash_1 = __importDefault(require("lodash"));
const browsers_1 = require("@puppeteer/browsers");
const utils_1 = require("../utils");
const registry_1 = __importDefault(require("../registry"));
const utils_2 = require("./utils");
const driver_1 = require("./driver");
const ubuntu_packages_1 = require("../ubuntu-packages");
const types_1 = require("../../browser/types");
const constants_1 = require("../constants");
const installFirefoxBrowser = async (version, { force = false } = {}) => {
    const platform = (0, utils_1.getBrowserPlatform)();
    const existingLocallyBrowserVersion = registry_1.default.getMatchedBrowserVersion(types_1.BrowserName.FIREFOX, platform, version);
    if (existingLocallyBrowserVersion && !force) {
        (0, utils_1.browserInstallerDebug)(`A locally installed firefox@${version} browser was found. Skipping the installation`);
        return registry_1.default.getBinaryPath(types_1.BrowserName.FIREFOX, platform, existingLocallyBrowserVersion);
    }
    const normalizedVersion = (0, utils_2.normalizeFirefoxVersion)(version);
    const buildId = (0, utils_2.getFirefoxBuildId)(normalizedVersion);
    const cacheDir = (0, utils_1.getBrowsersDir)();
    const canBeInstalled = await (0, browsers_1.canDownload)({ browser: types_1.BrowserName.FIREFOX, platform, buildId, cacheDir });
    if (!canBeInstalled) {
        throw new Error([
            `firefox@${version} can't be installed.`,
            `Probably the version '${version}' is invalid, please try another version.`,
            "Version examples: '120', '130.0', '131.0'",
        ].join("\n"));
    }
    (0, utils_1.browserInstallerDebug)(`installing firefox@${buildId} for ${platform}`);
    const installFn = (downloadProgressCallback) => (0, browsers_1.install)({
        platform,
        buildId,
        cacheDir,
        downloadProgressCallback,
        browser: types_1.BrowserName.FIREFOX,
        unpack: true,
    }).then(result => result.executablePath);
    return registry_1.default.installBinary(types_1.BrowserName.FIREFOX, platform, buildId, installFn);
};
const installFirefox = async (version, { force = false, needWebDriver = false, needUbuntuPackages = false } = {}) => {
    const [browserPath] = await Promise.all([
        installFirefoxBrowser(version, { force }),
        needWebDriver && (0, driver_1.installLatestGeckoDriver)(version, { force }),
        needUbuntuPackages && (0, ubuntu_packages_1.installUbuntuPackageDependencies)(),
    ]);
    return browserPath;
};
exports.installFirefox = installFirefox;
exports.resolveLatestFirefoxVersion = lodash_1.default.memoize(async (force = false) => {
    if (!force) {
        const platform = (0, utils_1.getBrowserPlatform)();
        const existingLocallyBrowserVersion = registry_1.default.getMatchedBrowserVersion(types_1.BrowserName.FIREFOX, platform);
        if (existingLocallyBrowserVersion) {
            return existingLocallyBrowserVersion;
        }
    }
    return (0, utils_1.retryFetch)(constants_1.FIREFOX_VERSIONS_LATEST_VERSIONS_API_URL)
        .then(res => res.json())
        .then(({ LATEST_FIREFOX_VERSION }) => LATEST_FIREFOX_VERSION)
        .catch(() => {
        throw new Error("Couldn't resolve latest firefox version");
    });
});
//# sourceMappingURL=browser.js.map