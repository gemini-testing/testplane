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
exports.installChromeDriver = void 0;
const browsers_1 = require("@puppeteer/browsers");
const constants_1 = require("../constants");
const utils_1 = require("../utils");
const registry_1 = __importDefault(require("../registry"));
const installChromeDriver = async (chromeVersion, { force = false } = {}) => {
    const platform = (0, utils_1.getBrowserPlatform)();
    const existingLocallyDriverVersion = registry_1.default.getMatchedDriverVersion(utils_1.DriverName.CHROMEDRIVER, platform, chromeVersion);
    if (existingLocallyDriverVersion && !force) {
        (0, utils_1.browserInstallerDebug)(`A locally installed chromedriver for chrome@${chromeVersion} was found. Skipping the installation`);
        return registry_1.default.getBinaryPath(utils_1.DriverName.CHROMEDRIVER, platform, existingLocallyDriverVersion);
    }
    const milestone = (0, utils_1.getMilestone)(chromeVersion);
    if (Number(milestone) < constants_1.MIN_CHROMEDRIVER_FOR_TESTING_VERSION) {
        (0, utils_1.browserInstallerDebug)(`installing chromedriver for chrome@${chromeVersion} from chromedriver.storage.googleapis.com manually`);
        const { installChromeDriverManually } = await Promise.resolve().then(() => __importStar(require("../chromium")));
        return installChromeDriverManually(milestone);
    }
    const buildId = await (0, browsers_1.resolveBuildId)(utils_1.DriverName.CHROMEDRIVER, platform, milestone);
    const cacheDir = (0, utils_1.getChromeDriverDir)();
    const canBeInstalled = await (0, browsers_1.canDownload)({ browser: utils_1.DriverName.CHROMEDRIVER, platform, buildId, cacheDir });
    if (!canBeInstalled) {
        throw new Error([
            `chromedriver@${buildId} can't be installed.`,
            `Probably the major browser version '${milestone}' is invalid`,
            "Correct chrome version examples: '123', '124'",
        ].join("\n"));
    }
    const installFn = (downloadProgressCallback) => (0, browsers_1.install)({
        platform,
        buildId,
        cacheDir: (0, utils_1.getChromeDriverDir)(),
        browser: utils_1.DriverName.CHROMEDRIVER,
        unpack: true,
        downloadProgressCallback,
    }).then(result => result.executablePath);
    return registry_1.default.installBinary(utils_1.DriverName.CHROMEDRIVER, platform, buildId, installFn);
};
exports.installChromeDriver = installChromeDriver;
//# sourceMappingURL=driver.js.map