import type { BrowserPlatform } from "@puppeteer/browsers";
import { readJsonSync, outputJSONSync, existsSync } from "fs-extra";
import path from "path";
import {
    getRegistryPath,
    browserInstallerDebug,
    Driver,
    Browser,
    getMilestone,
    normalizeChromeVersion,
    semverVersionsComparator,
    type SupportedBrowser,
    type SupportedDriver,
    type DownloadProgressCallback,
} from "../utils";
import { getFirefoxBuildId } from "../firefox/utils";
import logger from "../../utils/logger";
import type { createBrowserDownloadProgressBar } from "./cli-progress-bar";

type VersionToPathMap = Record<string, string | Promise<string>>;
type BinaryName = Exclude<SupportedBrowser | SupportedDriver, SupportedBrowser & SupportedDriver>;
type RegistryKey = `${BinaryName}_${BrowserPlatform}`;
type Registry = Record<RegistryKey, VersionToPathMap>;

const registryPath = getRegistryPath();
const registry: Registry = existsSync(registryPath) ? readJsonSync(registryPath) : {};

let cliProgressBar: ReturnType<typeof createBrowserDownloadProgressBar> | null = null;
let warnedFirstTimeInstall = false;

const getRegistryKey = (name: BinaryName, platform: BrowserPlatform): RegistryKey => `${name}_${platform}`;

export const getBinaryPath = async (name: BinaryName, platform: BrowserPlatform, version: string): Promise<string> => {
    const registryKey = getRegistryKey(name, platform);

    if (!registry[registryKey]) {
        throw new Error(`Binary '${name}' on '${platform}' is not installed`);
    }

    if (!registry[registryKey][version]) {
        throw new Error(`Version '${version}' of driver '${name}' on '${platform}' is not installed`);
    }

    const binaryRelativePath = await registry[registryKey][version];

    browserInstallerDebug(`resolved '${name}@${version}' on ${platform} to ${binaryRelativePath}`);

    return path.resolve(registryPath, binaryRelativePath);
};

const addBinaryToRegistry = (
    name: BinaryName,
    platform: BrowserPlatform,
    version: string,
    absoluteBinaryPath: string,
): void => {
    const registryKey = getRegistryKey(name, platform);
    const relativePath = path.relative(registryPath, absoluteBinaryPath);

    registry[registryKey] ||= {};
    registry[registryKey][version] = relativePath;

    const replacer = (_: string, value: unknown): unknown | undefined => {
        if ((value as Promise<unknown>).then) {
            return;
        }

        return value;
    };

    browserInstallerDebug(`adding '${name}@${version}' on '${platform}' to registry at ${relativePath}`);
    outputJSONSync(registryPath, registry, { replacer });
};

const getBinaryVersions = (name: BinaryName, platform: BrowserPlatform): string[] => {
    const registryKey = getRegistryKey(name, platform);

    if (!registry[registryKey]) {
        return [];
    }

    return Object.keys(registry[registryKey]);
};

const hasBinaryVersion = (name: BinaryName, platform: BrowserPlatform, version: string): boolean =>
    getBinaryVersions(name, platform).includes(version);

export const getMatchingDriverVersion = (
    driverName: SupportedDriver,
    platform: BrowserPlatform,
    browserVersion: string,
): string | null => {
    const registryKey = getRegistryKey(driverName, platform);

    if (!registry[registryKey]) {
        return null;
    }

    if (driverName === Driver.CHROMEDRIVER || driverName === Driver.EDGEDRIVER) {
        const milestone = getMilestone(browserVersion);
        const buildIds = getBinaryVersions(driverName, platform);
        const suitableBuildIds = buildIds.filter(buildId => buildId.startsWith(milestone));

        if (!suitableBuildIds.length) {
            return null;
        }

        const suitableBuildIdsSorted = suitableBuildIds.sort(semverVersionsComparator);

        return suitableBuildIdsSorted[suitableBuildIdsSorted.length - 1];
    }

    if (driverName === Driver.GECKODRIVER) {
        const buildIds = Object.keys(registry[registryKey]);
        const buildIdsSorted = buildIds.sort(semverVersionsComparator);

        return buildIdsSorted.length ? buildIdsSorted[buildIdsSorted.length - 1] : null;
    }

    return null;
};

export const getMatchingBrowserVersion = (
    browserName: SupportedBrowser,
    platform: BrowserPlatform,
    browserVersion: string,
): string | null => {
    const registryKey = getRegistryKey(browserName, platform);

    if (!registry[registryKey]) {
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

        return parseInt(a.replace(".", ""), 16) - parseInt(b.replace(".", ""), 16);
    };

    const comparator = browserName === Browser.FIREFOX ? firefoxVersionComparator : semverVersionsComparator;
    const suitableBuildIdsSorted = suitableBuildIds.sort(comparator);

    return suitableBuildIdsSorted[suitableBuildIdsSorted.length - 1];
};

export const installBinary = async (
    name: BinaryName,
    platform: BrowserPlatform,
    version: string,
    installFn: (downloadProgressCallback: DownloadProgressCallback) => Promise<string>,
): Promise<string> => {
    const registryKey = getRegistryKey(name, platform);

    if (hasBinaryVersion(name, platform, version)) {
        return getBinaryPath(name, platform, version);
    }

    browserInstallerDebug(`installing '${name}@${version}' on '${platform}'`);

    if (!cliProgressBar) {
        const { createBrowserDownloadProgressBar } = await import("./cli-progress-bar");

        cliProgressBar = createBrowserDownloadProgressBar();
    }

    const originalDownloadProgressCallback = cliProgressBar.register(name, version);
    const downloadProgressCallback: DownloadProgressCallback = (...args) => {
        if (!warnedFirstTimeInstall) {
            logger.warn("Downloading Testplane browsers");
            logger.warn("Note: this is one-time action. It may take a while...");

            warnedFirstTimeInstall = true;
        }

        return originalDownloadProgressCallback(...args);
    };

    const installPromise = installFn(downloadProgressCallback).then(executablePath => {
        addBinaryToRegistry(name, platform, version, executablePath);

        return executablePath;
    });

    registry[registryKey] ||= {};
    registry[registryKey][version] = installPromise;

    return installPromise;
};
