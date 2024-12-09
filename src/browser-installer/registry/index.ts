import type { BrowserPlatform } from "@puppeteer/browsers";
import _ from "lodash";
import { outputJSONSync } from "fs-extra";
import path from "path";
import {
    getRegistryPath,
    readRegistry,
    browserInstallerDebug,
    Driver,
    Browser,
    getMilestone,
    normalizeChromeVersion,
    semverVersionsComparator,
    type SupportedBrowser,
    type SupportedDriver,
    type DownloadProgressCallback,
    type BinaryKey,
    type BinaryName,
    type OsName,
    type OsVersion,
    type OsPackagesKey,
} from "../utils";
import { getFirefoxBuildId } from "../firefox/utils";
import logger from "../../utils/logger";

const registryPath = getRegistryPath();
const registry = readRegistry(registryPath);

const getRegistryBinaryKey = (name: BinaryName, platform: BrowserPlatform): BinaryKey => `${name}_${platform}`;
const getRegistryOsPackagesKey = (name: OsName, version: OsVersion): OsPackagesKey => `${name}_${version}`;

const saveRegistry = (): void => {
    const replacer = (_: string, value: unknown): unknown | undefined => {
        if ((value as Promise<unknown>).then) {
            return;
        }

        return value;
    };

    outputJSONSync(registryPath, registry, { replacer });
};

const getCliProgressBar = _.once(async () => {
    const { createBrowserDownloadProgressBar } = await import("./cli-progress-bar");

    return createBrowserDownloadProgressBar();
});

export const getBinaryPath = async (name: BinaryName, platform: BrowserPlatform, version: string): Promise<string> => {
    const registryKey = getRegistryBinaryKey(name, platform);

    if (!registry.binaries[registryKey]) {
        throw new Error(`Binary '${name}' on '${platform}' is not installed`);
    }

    if (!registry.binaries[registryKey][version]) {
        throw new Error(`Version '${version}' of driver '${name}' on '${platform}' is not installed`);
    }

    const binaryRelativePath = await registry.binaries[registryKey][version];

    browserInstallerDebug(`resolved '${name}@${version}' on ${platform} to ${binaryRelativePath}`);

    return path.resolve(registryPath, binaryRelativePath);
};

export const getOsPackagesPath = async (name: OsName, version: OsVersion): Promise<string> => {
    const registryKey = getRegistryOsPackagesKey(name, version);

    if (!registry.osPackages[registryKey]) {
        throw new Error(`Packages for ${name}@${version} are not installed`);
    }

    const osPackagesRelativePath = await registry.osPackages[registryKey];

    browserInstallerDebug(`resolved os packages for '${name}@${version}' to ${osPackagesRelativePath}`);

    return path.resolve(registryPath, osPackagesRelativePath);
};

const addBinaryToRegistry = (
    name: BinaryName,
    platform: BrowserPlatform,
    version: string,
    absoluteBinaryPath: string,
): void => {
    const registryKey = getRegistryBinaryKey(name, platform);
    const relativePath = path.relative(registryPath, absoluteBinaryPath);

    registry.binaries[registryKey] ||= {};
    registry.binaries[registryKey][version] = relativePath;

    browserInstallerDebug(`adding '${name}@${version}' on '${platform}' to registry at ${relativePath}`);

    saveRegistry();
};

const addOsPackageToRegistry = (name: OsName, version: OsVersion, absolutePackagesDirPath: string): void => {
    const registryKey = getRegistryOsPackagesKey(name, version);
    const relativePath = path.relative(registryPath, absolutePackagesDirPath);

    registry.osPackages[registryKey] = relativePath;

    browserInstallerDebug(`adding os packages for '${name}@${version}' to registry at ${relativePath}`);

    saveRegistry();
};

const getBinaryVersions = (name: BinaryName, platform: BrowserPlatform): string[] => {
    const registryKey = getRegistryBinaryKey(name, platform);

    if (!registry.binaries[registryKey]) {
        return [];
    }

    return Object.keys(registry.binaries[registryKey]);
};

const hasBinaryVersion = (name: BinaryName, platform: BrowserPlatform, version: string): boolean =>
    getBinaryVersions(name, platform).includes(version);

export const hasOsPackages = (name: OsName, version: OsVersion): boolean =>
    Boolean(registry.osPackages[getRegistryOsPackagesKey(name, version)]);

export const getMatchedDriverVersion = (
    driverName: SupportedDriver,
    platform: BrowserPlatform,
    browserVersion: string,
): string | null => {
    const registryKey = getRegistryBinaryKey(driverName, platform);

    if (!registry.binaries[registryKey]) {
        return null;
    }

    if (driverName === Driver.CHROMEDRIVER || driverName === Driver.EDGEDRIVER) {
        const milestone = getMilestone(browserVersion);
        const buildIds = getBinaryVersions(driverName, platform);
        const suitableBuildIds = buildIds.filter(buildId => buildId.startsWith(milestone));

        if (!suitableBuildIds.length) {
            return null;
        }

        return suitableBuildIds.sort(semverVersionsComparator).pop() as string;
    }

    if (driverName === Driver.GECKODRIVER) {
        const buildIds = Object.keys(registry.binaries[registryKey]);
        const buildIdsSorted = buildIds.sort(semverVersionsComparator);

        return buildIdsSorted.length ? buildIdsSorted[buildIdsSorted.length - 1] : null;
    }

    return null;
};

export const getMatchedBrowserVersion = (
    browserName: SupportedBrowser,
    platform: BrowserPlatform,
    browserVersion: string,
): string | null => {
    const registryKey = getRegistryBinaryKey(browserName, platform);

    if (!registry.binaries[registryKey]) {
        return null;
    }

    let buildPrefix: string;

    switch (browserName) {
        case Browser.CHROME:
            buildPrefix = normalizeChromeVersion(browserVersion);
            break;

        case Browser.CHROMIUM:
            buildPrefix = getMilestone(browserVersion);
            break;

        case Browser.FIREFOX:
            buildPrefix = getFirefoxBuildId(browserVersion);
            break;

        default:
            return null;
    }

    const buildIds = getBinaryVersions(browserName, platform);
    const suitableBuildIds = buildIds.filter(buildId => buildId.startsWith(buildPrefix));

    if (!suitableBuildIds.length) {
        return null;
    }

    const firefoxVersionComparator = (a: string, b: string): number => {
        a = a.slice(a.indexOf("_") + 1);
        b = b.slice(b.indexOf("_") + 1);

        // Firefox has versions like "stable_131.0a1" and "stable_129.0b9"
        // Parsing raw numbers as hex values is needed in order to distinguish "129.0b9" and "129.0b7" for example
        return parseInt(a.replace(".", ""), 16) - parseInt(b.replace(".", ""), 16);
    };

    const comparator = browserName === Browser.FIREFOX ? firefoxVersionComparator : semverVersionsComparator;
    const suitableBuildIdsSorted = suitableBuildIds.sort(comparator);

    return suitableBuildIdsSorted[suitableBuildIdsSorted.length - 1];
};

const logDownloadingOsPackagesWarningOnce = _.once((osName: string) => {
    logger.warn(`Downloading extra ${osName} packages`);
});

const logDownloadingBrowsersWarningOnce = _.once(() => {
    logger.warn("Downloading Testplane browsers");
    logger.warn("Note: this is one-time action. It may take a while...");
});

export const installBinary = async (
    name: BinaryName,
    platform: BrowserPlatform,
    version: string,
    installFn: (downloadProgressCallback: DownloadProgressCallback) => Promise<string>,
): Promise<string> => {
    const registryKey = getRegistryBinaryKey(name, platform);

    if (hasBinaryVersion(name, platform, version)) {
        return getBinaryPath(name, platform, version);
    }

    browserInstallerDebug(`installing '${name}@${version}' on '${platform}'`);

    const progressBar = await getCliProgressBar();

    const originalDownloadProgressCallback = progressBar.register(name, version);
    const downloadProgressCallback: DownloadProgressCallback = (...args) => {
        logDownloadingBrowsersWarningOnce();

        return originalDownloadProgressCallback(...args);
    };

    const installPromise = installFn(downloadProgressCallback)
        .then(executablePath => {
            addBinaryToRegistry(name, platform, version, executablePath);

            return executablePath;
        })
        .catch(err => {
            progressBar?.stop();

            throw err;
        });

    registry.binaries[registryKey] ||= {};
    registry.binaries[registryKey][version] = installPromise;

    return installPromise;
};

export const installOsPackages = async (
    osName: OsName,
    version: OsVersion,
    installFn: (downloadProgressCallback: DownloadProgressCallback) => Promise<string>,
): Promise<string> => {
    const registryKey = getRegistryOsPackagesKey(osName, version);

    if (hasOsPackages(osName, version)) {
        return getOsPackagesPath(osName, version);
    }

    browserInstallerDebug(`installing os packages for '${osName}@${version}'`);

    logDownloadingOsPackagesWarningOnce(osName);

    const progressBar = await getCliProgressBar();

    const downloadProgressCallback = progressBar.register(`extra packages for ${osName}`, version);

    const installPromise = installFn(downloadProgressCallback)
        .then(packagesPath => {
            addOsPackageToRegistry(osName, version, packagesPath);

            return packagesPath;
        })
        .catch(err => {
            progressBar.stop();

            throw err;
        });

    registry.osPackages[registryKey] = installPromise;

    return installPromise;
};
