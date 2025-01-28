"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installLatestGeckoDriver = void 0;
const geckodriver_1 = require("geckodriver");
const constants_1 = require("../constants");
const registry_1 = __importDefault(require("../registry"));
const utils_1 = require("../utils");
const getLatestGeckoDriverVersion = async () => {
    const cargoVersionsToml = await (0, utils_1.retryFetch)(constants_1.GECKODRIVER_CARGO_TOML).then(res => res.text());
    const version = cargoVersionsToml.split("\n").find(line => line.startsWith("version = "));
    if (!version) {
        throw new Error("Couldn't resolve latest geckodriver version while downloading geckodriver");
    }
    const latestGeckoVersion = version.split(" = ").pop().slice(1, -1);
    (0, utils_1.browserInstallerDebug)(`resolved latest geckodriver version: ${latestGeckoVersion}`);
    return latestGeckoVersion;
};
const installLatestGeckoDriver = async (firefoxVersion, { force = false } = {}) => {
    const platform = (0, utils_1.getBrowserPlatform)();
    const existingLocallyDriverVersion = registry_1.default.getMatchedDriverVersion(utils_1.DriverName.GECKODRIVER, platform, firefoxVersion);
    if (existingLocallyDriverVersion && !force) {
        (0, utils_1.browserInstallerDebug)(`A locally installed geckodriver for firefox@${firefoxVersion} browser was found. Skipping the installation`);
        return registry_1.default.getBinaryPath(utils_1.DriverName.GECKODRIVER, platform, existingLocallyDriverVersion);
    }
    const latestVersion = await getLatestGeckoDriverVersion();
    const installFn = () => (0, geckodriver_1.download)(latestVersion, (0, utils_1.getGeckoDriverDir)(latestVersion));
    return registry_1.default.installBinary(utils_1.DriverName.GECKODRIVER, platform, latestVersion, installFn);
};
exports.installLatestGeckoDriver = installLatestGeckoDriver;
//# sourceMappingURL=driver.js.map