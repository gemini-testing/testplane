"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installChromeDriverManually = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const lodash_1 = require("lodash");
const constants_1 = require("../constants");
const registry_1 = __importDefault(require("../registry"));
const utils_1 = require("../utils");
const utils_2 = require("./utils");
const getChromeDriverVersionByChromiumVersion = async (chromiumVersion) => {
    const suffix = typeof chromiumVersion === "number" ? chromiumVersion : (0, utils_1.normalizeChromeVersion)(chromiumVersion);
    const result = await (0, utils_1.retryFetch)(`${constants_1.CHROMEDRIVER_STORAGE_API}/LATEST_RELEASE_${suffix}`).then(res => res.text());
    return result;
};
const installChromeDriverManually = async (milestone) => {
    const platform = (0, utils_1.getBrowserPlatform)();
    if (Number(milestone) < constants_1.MIN_CHROMIUM_VERSION) {
        throw new Error([
            `chromedriver@${milestone} can't be installed.`,
            `Automatic driver downloader is not available for chrome versions < ${constants_1.MIN_CHROMIUM_VERSION}`,
        ].join("\n"));
    }
    const driverVersion = await getChromeDriverVersionByChromiumVersion(milestone);
    const installFn = async () => {
        const archiveUrl = (0, utils_2.getChromeDriverArchiveUrl)(driverVersion);
        const archivePath = (0, utils_2.getChromeDriverArchiveTmpPath)(driverVersion);
        const chromeDriverDirPath = (0, utils_1.getChromiumDriverDir)(driverVersion);
        const chromeDriverPath = path_1.default.join(chromeDriverDirPath, "chromedriver");
        await (0, utils_1.downloadFile)(archiveUrl, archivePath);
        await (0, utils_1.unzipFile)(archivePath, chromeDriverDirPath);
        fs_extra_1.default.remove(archivePath).then(lodash_1.noop, lodash_1.noop);
        return chromeDriverPath;
    };
    return registry_1.default.installBinary(utils_1.DriverName.CHROMEDRIVER, platform, driverVersion, installFn);
};
exports.installChromeDriverManually = installChromeDriverManually;
//# sourceMappingURL=driver.js.map