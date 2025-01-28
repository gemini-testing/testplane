"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLatestChromeVersion = exports.installChrome = void 0;
const lodash_1 = __importDefault(require("lodash"));
const browsers_1 = require("@puppeteer/browsers");
const constants_1 = require("../constants");
const utils_1 = require("../utils");
const registry_1 = __importDefault(require("../registry"));
const utils_2 = require("../utils");
const ubuntu_packages_1 = require("../ubuntu-packages");
const driver_1 = require("./driver");
const types_1 = require("../../browser/types");
const installChromeBrowser = async (version, { force = false } = {}) => {
    const milestone = (0, utils_1.getMilestone)(version);
    if (Number(milestone) < constants_1.MIN_CHROME_FOR_TESTING_VERSION) {
        (0, utils_1.browserInstallerDebug)(`couldn't install chrome@${version}, installing chromium instead`);
        const { installChromium } = await Promise.resolve().then(() => __importStar(require("../chromium")));
        return installChromium(version, { force });
    }
    const platform = (0, utils_1.getBrowserPlatform)();
    const existingLocallyBrowserVersion = registry_1.default.getMatchedBrowserVersion(types_1.BrowserName.CHROME, platform, version);
    if (existingLocallyBrowserVersion && !force) {
        (0, utils_1.browserInstallerDebug)(`A locally installed chrome@${version} browser was found. Skipping the installation`);
        return registry_1.default.getBinaryPath(types_1.BrowserName.CHROME, platform, existingLocallyBrowserVersion);
    }
    const normalizedVersion = (0, utils_2.normalizeChromeVersion)(version);
    const buildId = await (0, browsers_1.resolveBuildId)(types_1.BrowserName.CHROME, platform, normalizedVersion);
    const cacheDir = (0, utils_1.getBrowsersDir)();
    const canBeInstalled = await (0, browsers_1.canDownload)({ browser: types_1.BrowserName.CHROME, platform, buildId, cacheDir });
    if (!canBeInstalled) {
        throw new Error([
            `chrome@${version} can't be installed.`,
            `Probably the version '${version}' is invalid, please try another version.`,
            "Version examples: '120', '120.0'",
        ].join("\n"));
    }
    const installFn = (downloadProgressCallback) => (0, browsers_1.install)({
        platform,
        buildId,
        cacheDir,
        downloadProgressCallback,
        browser: types_1.BrowserName.CHROME,
        unpack: true,
    }).then(result => result.executablePath);
    return registry_1.default.installBinary(types_1.BrowserName.CHROME, platform, buildId, installFn);
};
const installChrome = async (version, { force = false, needWebDriver = false, needUbuntuPackages = false } = {}) => {
    const [browserPath] = await Promise.all([
        installChromeBrowser(version, { force }),
        needWebDriver && (0, driver_1.installChromeDriver)(version, { force }),
        needUbuntuPackages && (0, ubuntu_packages_1.installUbuntuPackageDependencies)(),
    ]);
    return browserPath;
};
exports.installChrome = installChrome;
exports.resolveLatestChromeVersion = lodash_1.default.memoize(async (force = false) => {
    if (!force) {
        const platform = (0, utils_1.getBrowserPlatform)();
        const existingLocallyBrowserVersion = registry_1.default.getMatchedBrowserVersion(types_1.BrowserName.CHROME, platform);
        if (existingLocallyBrowserVersion) {
            return existingLocallyBrowserVersion;
        }
    }
    return (0, utils_1.retryFetch)(constants_1.CHROME_FOR_TESTING_LATEST_STABLE_API_URL)
        .then(res => res.text())
        .catch(() => {
        throw new Error("Couldn't resolve latest chrome version");
    });
});
//# sourceMappingURL=browser.js.map