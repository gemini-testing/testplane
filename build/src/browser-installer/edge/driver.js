"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installEdgeDriver = void 0;
const edgedriver_1 = require("edgedriver");
const utils_1 = require("../utils");
const registry_1 = __importDefault(require("../registry"));
const constants_1 = require("../constants");
const getLatestMajorEdgeDriverVersion = async (milestone) => {
    const fullVersion = await (0, utils_1.retryFetch)(`${constants_1.MSEDGEDRIVER_API}/LATEST_RELEASE_${milestone}`).then(res => res.text());
    if (!fullVersion) {
        throw new Error(`Couldn't resolve latest edgedriver version for ${milestone}`);
    }
    const versionNormalized = fullVersion
        .split("")
        .filter(char => /\.|\d/.test(char))
        .join("");
    (0, utils_1.browserInstallerDebug)(`resolved latest edgedriver@${milestone} version: ${versionNormalized}`);
    return versionNormalized;
};
const installEdgeDriver = async (edgeVersion, { force = false } = {}) => {
    const platform = (0, utils_1.getBrowserPlatform)();
    const existingLocallyDriverVersion = registry_1.default.getMatchedDriverVersion(utils_1.DriverName.EDGEDRIVER, platform, edgeVersion);
    if (existingLocallyDriverVersion && !force) {
        (0, utils_1.browserInstallerDebug)(`A locally installed edgedriver for edge@${edgeVersion} browser was found. Skipping the installation`);
        return registry_1.default.getBinaryPath(utils_1.DriverName.EDGEDRIVER, platform, existingLocallyDriverVersion);
    }
    const milestone = (0, utils_1.getMilestone)(edgeVersion);
    if (Number(milestone) < constants_1.MIN_EDGEDRIVER_VERSION) {
        throw new Error(`Automatic driver downloader is not available for Edge versions < ${constants_1.MIN_EDGEDRIVER_VERSION}`);
    }
    const driverVersion = await getLatestMajorEdgeDriverVersion(milestone);
    const installFn = () => (0, edgedriver_1.download)(driverVersion, (0, utils_1.getEdgeDriverDir)(driverVersion));
    return registry_1.default.installBinary(utils_1.DriverName.EDGEDRIVER, platform, driverVersion, installFn);
};
exports.installEdgeDriver = installEdgeDriver;
//# sourceMappingURL=driver.js.map