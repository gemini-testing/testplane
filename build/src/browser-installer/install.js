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
exports.installBrowsersWithDrivers = exports.BrowserInstallStatus = exports.installBrowser = void 0;
const lodash_1 = __importDefault(require("lodash"));
const utils_1 = require("./utils");
const browser_1 = require("../utils/browser");
const types_1 = require("../browser/types");
/**
 * @returns path to installed browser binary
 */
const installBrowser = async (browserName, browserVersion, { force = false, shouldInstallWebDriver = false, shouldInstallUbuntuPackages = false } = {}) => {
    const { isUbuntu } = await Promise.resolve().then(() => __importStar(require("./ubuntu-packages")));
    const needUbuntuPackages = shouldInstallUbuntuPackages && (await isUbuntu());
    (0, utils_1.browserInstallerDebug)([
        `install ${browserName}@${browserVersion}`,
        `shouldInstallWebDriver:${shouldInstallWebDriver}`,
        `shouldInstallUbuntuPackages:${shouldInstallUbuntuPackages}`,
        `needUbuntuPackages:${needUbuntuPackages}`,
    ].join(", "));
    switch (browserName) {
        case types_1.BrowserName.CHROME:
        case types_1.BrowserName.CHROMIUM: {
            const { installChrome, resolveLatestChromeVersion } = await Promise.resolve().then(() => __importStar(require("./chrome")));
            const version = browserVersion || (await resolveLatestChromeVersion(force));
            return installChrome(version, { force, needUbuntuPackages, needWebDriver: shouldInstallWebDriver });
        }
        case types_1.BrowserName.FIREFOX: {
            const { installFirefox, resolveLatestFirefoxVersion } = await Promise.resolve().then(() => __importStar(require("./firefox")));
            const version = browserVersion || (await resolveLatestFirefoxVersion(force));
            return installFirefox(version, { force, needUbuntuPackages, needWebDriver: shouldInstallWebDriver });
        }
        case types_1.BrowserName.EDGE: {
            const { installEdgeDriver, resolveEdgeVersion } = await Promise.resolve().then(() => __importStar(require("./edge")));
            const version = browserVersion || (await resolveEdgeVersion());
            if (shouldInstallWebDriver) {
                await installEdgeDriver(version, { force });
            }
            return null;
        }
        case types_1.BrowserName.SAFARI: {
            return null;
        }
    }
};
exports.installBrowser = installBrowser;
exports.BrowserInstallStatus = {
    Ok: "ok",
    Skip: "skip",
    Error: "error",
};
const forceInstallBinaries = async (installFn, browserName, browserVersion) => {
    const normalizedBrowserName = (0, browser_1.getNormalizedBrowserName)(browserName);
    const installOpts = { force: true, shouldInstallWebDriver: true, shouldInstallUbuntuPackages: true };
    if (!normalizedBrowserName) {
        return {
            status: exports.BrowserInstallStatus.Error,
            reason: `Installing ${browserName} is unsupported. Supported browsers: "chrome", "firefox", "safari", "edge"`,
        };
    }
    return installFn(normalizedBrowserName, browserVersion, installOpts)
        .then(successResult => {
        return successResult
            ? { status: exports.BrowserInstallStatus.Ok }
            : {
                status: exports.BrowserInstallStatus.Skip,
                reason: `Installing ${browserName} is unsupported. Assuming it is installed locally`,
            };
    })
        .catch(errorResult => ({ status: exports.BrowserInstallStatus.Error, reason: errorResult.message }));
};
const installBrowsersWithDrivers = async (browsersToInstall) => {
    const uniqBrowsers = lodash_1.default.uniqBy(browsersToInstall, b => `${b.browserName}@${b.browserVersion}`);
    const installPromises = [];
    const browsersInstallResult = {};
    for (const { browserName, browserVersion } of uniqBrowsers) {
        installPromises.push(forceInstallBinaries(exports.installBrowser, browserName, browserVersion).then(result => {
            const key = browserVersion ? `${browserName}@${browserVersion}` : String(browserName);
            browsersInstallResult[key] = result;
        }));
    }
    await Promise.all(installPromises);
    return browsersInstallResult;
};
exports.installBrowsersWithDrivers = installBrowsersWithDrivers;
//# sourceMappingURL=install.js.map