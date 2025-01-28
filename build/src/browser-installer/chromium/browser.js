"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installChromium = void 0;
const browsers_1 = require("@puppeteer/browsers");
const registry_1 = __importDefault(require("../registry"));
const utils_1 = require("../utils");
const utils_2 = require("./utils");
const utils_3 = require("../utils");
const constants_1 = require("../constants");
const types_1 = require("../../browser/types");
const installChromium = async (version, { force = false } = {}) => {
    const milestone = (0, utils_1.getMilestone)(version);
    if (Number(milestone) < constants_1.MIN_CHROMIUM_VERSION) {
        throw new Error([
            `chrome@${version} can't be installed.`,
            `Automatic browser downloader is not available for chrome versions < ${constants_1.MIN_CHROMIUM_VERSION}`,
        ].join("\n"));
    }
    const platform = (0, utils_3.getChromePlatform)(version);
    const existingLocallyBrowserVersion = registry_1.default.getMatchedBrowserVersion(types_1.BrowserName.CHROMIUM, platform, version);
    if (existingLocallyBrowserVersion && !force) {
        (0, utils_1.browserInstallerDebug)(`A locally installed chromium@${version} browser was found. Skipping the installation`);
        return registry_1.default.getBinaryPath(types_1.BrowserName.CHROMIUM, platform, existingLocallyBrowserVersion);
    }
    const buildId = await (0, utils_2.getChromiumBuildId)(platform, milestone);
    const cacheDir = (0, utils_1.getBrowsersDir)();
    const canBeInstalled = await (0, browsers_1.canDownload)({ browser: types_1.BrowserName.CHROMIUM, platform, buildId, cacheDir });
    if (!canBeInstalled) {
        throw new Error([
            `chrome@${version} can't be installed.`,
            `Probably the version '${version}' is invalid, please try another version.`,
            "Version examples: '93', '93.0'",
        ].join("\n"));
    }
    (0, utils_1.browserInstallerDebug)(`installing chromium@${buildId} (${milestone}) for ${platform}`);
    const installFn = (downloadProgressCallback) => (0, browsers_1.install)({
        platform,
        buildId,
        cacheDir,
        downloadProgressCallback,
        browser: types_1.BrowserName.CHROMIUM,
        unpack: true,
    }).then(result => result.executablePath);
    return registry_1.default.installBinary(types_1.BrowserName.CHROMIUM, platform, milestone, installFn);
};
exports.installChromium = installChromium;
//# sourceMappingURL=browser.js.map