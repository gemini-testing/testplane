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
const lodash_1 = __importDefault(require("lodash"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils");
const utils_2 = require("../firefox/utils");
const logger_1 = __importDefault(require("../../utils/logger"));
const types_1 = require("../../browser/types");
const getRegistryBinaryKey = (name, platform) => `${name}_${platform}`;
const getRegistryOsPackagesKey = (name, version) => `${name}_${version}`;
const getCliProgressBar = lodash_1.default.once(async () => {
    const { createBrowserDownloadProgressBar } = await Promise.resolve().then(() => __importStar(require("./cli-progress-bar")));
    return createBrowserDownloadProgressBar();
});
const logDownloadingOsPackagesWarningOnce = lodash_1.default.once((osName) => {
    logger_1.default.warn(`Downloading extra ${osName} packages`);
});
const logDownloadingBrowsersWarningOnce = lodash_1.default.once(() => {
    logger_1.default.warn("Downloading Testplane browsers");
    logger_1.default.warn("Note: this is one-time action. It may take a while...");
});
const getBuildPrefix = (browserName, browserVersion) => {
    switch (browserName) {
        case types_1.BrowserName.CHROME:
            return (0, utils_1.normalizeChromeVersion)(browserVersion);
        case types_1.BrowserName.CHROMIUM:
            return (0, utils_1.getMilestone)(browserVersion);
        case types_1.BrowserName.FIREFOX:
            return (0, utils_2.getFirefoxBuildId)(browserVersion);
        default:
            return null;
    }
};
class Registry {
    constructor() {
        this.registryPath = (0, utils_1.getRegistryPath)();
        this.registry = this.readRegistry();
    }
    async getBinaryPath(name, platform, version) {
        const registryKey = getRegistryBinaryKey(name, platform);
        if (!this.registry.binaries[registryKey]) {
            throw new Error(`Binary '${name}' on '${platform}' is not installed`);
        }
        if (!this.registry.binaries[registryKey][version]) {
            throw new Error(`Version '${version}' of driver '${name}' on '${platform}' is not installed`);
        }
        const binaryRelativePath = await this.registry.binaries[registryKey][version];
        (0, utils_1.browserInstallerDebug)(`resolved '${name}@${version}' on ${platform} to ${binaryRelativePath}`);
        return path_1.default.resolve(this.registryPath, binaryRelativePath);
    }
    async getOsPackagesPath(name, version) {
        const registryKey = getRegistryOsPackagesKey(name, version);
        if (!this.registry.osPackages[registryKey]) {
            throw new Error(`Packages for ${name}@${version} are not installed`);
        }
        const osPackagesRelativePath = await this.registry.osPackages[registryKey];
        (0, utils_1.browserInstallerDebug)(`resolved os packages for '${name}@${version}' to ${osPackagesRelativePath}`);
        return path_1.default.resolve(this.registryPath, osPackagesRelativePath);
    }
    hasOsPackages(name, version) {
        return Boolean(this.registry.osPackages[getRegistryOsPackagesKey(name, version)]);
    }
    getMatchedDriverVersion(driverName, platform, browserVersion) {
        const registryKey = getRegistryBinaryKey(driverName, platform);
        if (!this.registry.binaries[registryKey]) {
            return null;
        }
        if (driverName === utils_1.DriverName.CHROMEDRIVER || driverName === utils_1.DriverName.EDGEDRIVER) {
            const milestone = (0, utils_1.getMilestone)(browserVersion);
            const buildIds = this.getBinaryVersions(driverName, platform);
            const suitableBuildIds = buildIds.filter(buildId => buildId.startsWith(milestone));
            if (!suitableBuildIds.length) {
                return null;
            }
            return suitableBuildIds.sort(utils_1.semverVersionsComparator).pop();
        }
        if (driverName === utils_1.DriverName.GECKODRIVER) {
            const buildIds = Object.keys(this.registry.binaries[registryKey]);
            const buildIdsSorted = buildIds.sort(utils_1.semverVersionsComparator);
            return buildIdsSorted.length ? buildIdsSorted[buildIdsSorted.length - 1] : null;
        }
        return null;
    }
    getMatchedBrowserVersion(browserName, platform, browserVersion) {
        const registryKey = getRegistryBinaryKey(browserName, platform);
        if (!this.registry.binaries[registryKey]) {
            return null;
        }
        const buildIds = this.getBinaryVersions(browserName, platform);
        let suitableBuildIds;
        if (!browserVersion) {
            suitableBuildIds = buildIds;
        }
        else {
            const buildPrefix = getBuildPrefix(browserName, browserVersion);
            if (buildPrefix === null) {
                return null;
            }
            suitableBuildIds = buildIds.filter(buildId => buildId.startsWith(buildPrefix));
        }
        if (!suitableBuildIds.length) {
            return null;
        }
        const firefoxVersionComparator = (a, b) => {
            a = a.slice(a.indexOf("_") + 1);
            b = b.slice(b.indexOf("_") + 1);
            // Firefox has versions like "stable_131.0a1" and "stable_129.0b9"
            // Parsing raw numbers as hex values is needed in order to distinguish "129.0b9" and "129.0b7" for example
            return parseInt(a.replace(".", ""), 16) - parseInt(b.replace(".", ""), 16);
        };
        const comparator = browserName === types_1.BrowserName.FIREFOX ? firefoxVersionComparator : utils_1.semverVersionsComparator;
        const suitableBuildIdsSorted = suitableBuildIds.sort(comparator);
        return suitableBuildIdsSorted[suitableBuildIdsSorted.length - 1];
    }
    async installBinary(name, platform, version, installFn) {
        const registryKey = getRegistryBinaryKey(name, platform);
        if (this.hasBinaryVersion(name, platform, version)) {
            return this.getBinaryPath(name, platform, version);
        }
        (0, utils_1.browserInstallerDebug)(`installing '${name}@${version}' on '${platform}'`);
        const progressBar = await getCliProgressBar();
        const originalDownloadProgressCallback = progressBar.register(name, version);
        const downloadProgressCallback = (...args) => {
            logDownloadingBrowsersWarningOnce();
            return originalDownloadProgressCallback(...args);
        };
        const installPromise = installFn(downloadProgressCallback)
            .then(executablePath => {
            this.addBinaryToRegistry(name, platform, version, executablePath);
            return executablePath;
        })
            .catch(err => {
            progressBar?.stop();
            throw err;
        });
        this.registry.binaries[registryKey] ||= {};
        this.registry.binaries[registryKey][version] = installPromise;
        return installPromise;
    }
    async installOsPackages(osName, version, installFn) {
        const registryKey = getRegistryOsPackagesKey(osName, version);
        if (this.hasOsPackages(osName, version)) {
            return this.getOsPackagesPath(osName, version);
        }
        (0, utils_1.browserInstallerDebug)(`installing os packages for '${osName}@${version}'`);
        logDownloadingOsPackagesWarningOnce(osName);
        const progressBar = await getCliProgressBar();
        const downloadProgressCallback = progressBar.register(`extra packages for ${osName}`, version);
        const installPromise = installFn(downloadProgressCallback)
            .then(packagesPath => {
            this.addOsPackageToRegistry(osName, version, packagesPath);
            return packagesPath;
        })
            .catch(err => {
            progressBar.stop();
            throw err;
        });
        this.registry.osPackages[registryKey] = installPromise;
        return installPromise;
    }
    readRegistry() {
        const registry = fs_extra_1.default.existsSync(this.registryPath)
            ? fs_extra_1.default.readJSONSync(this.registryPath)
            : {};
        registry.binaries ||= {};
        registry.osPackages ||= {};
        registry.meta ||= { version: 1 };
        return registry;
    }
    writeRegistry() {
        const replacer = (_, value) => {
            if (value.then) {
                return;
            }
            return value;
        };
        fs_extra_1.default.outputJSONSync(this.registryPath, this.registry, { replacer });
    }
    addBinaryToRegistry(name, platform, version, absoluteBinaryPath) {
        const registryKey = getRegistryBinaryKey(name, platform);
        const relativePath = path_1.default.relative(this.registryPath, absoluteBinaryPath);
        this.registry.binaries[registryKey] ||= {};
        this.registry.binaries[registryKey][version] = relativePath;
        (0, utils_1.browserInstallerDebug)(`adding '${name}@${version}' on '${platform}' to registry at ${relativePath}`);
        this.writeRegistry();
    }
    addOsPackageToRegistry(name, version, absolutePackagesDirPath) {
        const registryKey = getRegistryOsPackagesKey(name, version);
        const relativePath = path_1.default.relative(this.registryPath, absolutePackagesDirPath);
        this.registry.osPackages[registryKey] = relativePath;
        (0, utils_1.browserInstallerDebug)(`adding os packages for '${name}@${version}' to registry at ${relativePath}`);
        this.writeRegistry();
    }
    getBinaryVersions(name, platform) {
        const registryKey = getRegistryBinaryKey(name, platform);
        if (!this.registry.binaries[registryKey]) {
            return [];
        }
        return Object.keys(this.registry.binaries[registryKey]);
    }
    hasBinaryVersion(name, platform, version) {
        return this.getBinaryVersions(name, platform).includes(version);
    }
}
exports.default = new Registry();
//# sourceMappingURL=index.js.map