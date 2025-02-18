import type { BrowserPlatform } from "@puppeteer/browsers";
import _ from "lodash";
import fs from "fs-extra";
import path from "path";
import {
    getRegistryPath,
    browserInstallerDebug,
    DriverName,
    getMilestone,
    normalizeChromeVersion,
    semverVersionsComparator,
    type SupportedBrowser,
    type SupportedDriver,
    type DownloadProgressCallback,
} from "../utils";
import { getFirefoxBuildId } from "../firefox/utils";
import * as logger from "../../utils/logger";
import { BrowserName } from "../../browser/types";

type VersionToPathMap = Record<string, string | Promise<string>>;
type BinaryName = Exclude<SupportedBrowser | SupportedDriver, SupportedBrowser & SupportedDriver>;
type BinaryKey = `${BinaryName}_${BrowserPlatform}`;
type OsName = string;
type OsVersion = string;
type OsPackagesKey = `${OsName}_${OsVersion}`;
export type RegistryFileContents = {
    binaries: Record<BinaryKey, VersionToPathMap>;
    osPackages: Record<OsPackagesKey, string | Promise<string>>;
    meta: { version: number };
};

const getRegistryBinaryKey = (name: BinaryName, platform: BrowserPlatform): BinaryKey => `${name}_${platform}`;
const getRegistryOsPackagesKey = (name: OsName, version: OsVersion): OsPackagesKey => `${name}_${version}`;

const getCliProgressBar = _.once(async () => {
    const { createBrowserDownloadProgressBar } = await import("./cli-progress-bar");

    return createBrowserDownloadProgressBar();
});

const logDownloadingOsPackagesWarningOnce = _.once((osName: string) => {
    logger.warn(`Downloading extra ${osName} packages`);
});

const logDownloadingBrowsersWarningOnce = _.once(() => {
    logger.warn("Downloading Testplane browsers");
    logger.warn("Note: this is one-time action. It may take a while...");
});

const getBuildPrefix = (browserName: SupportedBrowser, browserVersion: string): string | null => {
    switch (browserName) {
        case BrowserName.CHROME:
            return normalizeChromeVersion(browserVersion);

        case BrowserName.CHROMIUM:
            return getMilestone(browserVersion);

        case BrowserName.FIREFOX:
            return getFirefoxBuildId(browserVersion);

        default:
            return null;
    }
};

class Registry {
    private registryPath = getRegistryPath();
    private registry = this.readRegistry();

    public async getBinaryPath(name: BinaryName, platform: BrowserPlatform, version: string): Promise<string> {
        const registryKey = getRegistryBinaryKey(name, platform);

        if (!this.registry.binaries[registryKey]) {
            throw new Error(`Binary '${name}' on '${platform}' is not installed`);
        }

        if (!this.registry.binaries[registryKey][version]) {
            throw new Error(`Version '${version}' of driver '${name}' on '${platform}' is not installed`);
        }

        const binaryRelativePath = await this.registry.binaries[registryKey][version];

        browserInstallerDebug(`resolved '${name}@${version}' on ${platform} to ${binaryRelativePath}`);

        return path.resolve(this.registryPath, binaryRelativePath);
    }

    public async getOsPackagesPath(name: OsName, version: OsVersion): Promise<string> {
        const registryKey = getRegistryOsPackagesKey(name, version);

        if (!this.registry.osPackages[registryKey]) {
            throw new Error(`Packages for ${name}@${version} are not installed`);
        }

        const osPackagesRelativePath = await this.registry.osPackages[registryKey];

        browserInstallerDebug(`resolved os packages for '${name}@${version}' to ${osPackagesRelativePath}`);

        return path.resolve(this.registryPath, osPackagesRelativePath);
    }

    public hasOsPackages(name: OsName, version: OsVersion): boolean {
        return Boolean(this.registry.osPackages[getRegistryOsPackagesKey(name, version)]);
    }

    public getMatchedDriverVersion(
        driverName: SupportedDriver,
        platform: BrowserPlatform,
        browserVersion: string,
    ): string | null {
        const registryKey = getRegistryBinaryKey(driverName, platform);

        if (!this.registry.binaries[registryKey]) {
            return null;
        }

        if (driverName === DriverName.CHROMEDRIVER || driverName === DriverName.EDGEDRIVER) {
            const milestone = getMilestone(browserVersion);
            const buildIds = this.getBinaryVersions(driverName, platform);
            const suitableBuildIds = buildIds.filter(buildId => buildId.startsWith(milestone));

            if (!suitableBuildIds.length) {
                return null;
            }

            return suitableBuildIds.sort(semverVersionsComparator).pop() as string;
        }

        if (driverName === DriverName.GECKODRIVER) {
            const buildIds = Object.keys(this.registry.binaries[registryKey]);
            const buildIdsSorted = buildIds.sort(semverVersionsComparator);

            return buildIdsSorted.length ? buildIdsSorted[buildIdsSorted.length - 1] : null;
        }

        return null;
    }

    public getMatchedBrowserVersion(
        browserName: SupportedBrowser,
        platform: BrowserPlatform,
        browserVersion?: string,
    ): string | null {
        const registryKey = getRegistryBinaryKey(browserName, platform);

        if (!this.registry.binaries[registryKey]) {
            return null;
        }

        const buildIds = this.getBinaryVersions(browserName, platform);

        let suitableBuildIds;

        if (!browserVersion) {
            suitableBuildIds = buildIds;
        } else {
            const buildPrefix = getBuildPrefix(browserName, browserVersion);

            if (buildPrefix === null) {
                return null;
            }

            suitableBuildIds = buildIds.filter(buildId => buildId.startsWith(buildPrefix));
        }

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

        const comparator = browserName === BrowserName.FIREFOX ? firefoxVersionComparator : semverVersionsComparator;
        const suitableBuildIdsSorted = suitableBuildIds.sort(comparator);

        return suitableBuildIdsSorted[suitableBuildIdsSorted.length - 1];
    }

    public async installBinary(
        name: BinaryName,
        platform: BrowserPlatform,
        version: string,
        installFn: (downloadProgressCallback: DownloadProgressCallback) => Promise<string>,
    ): Promise<string> {
        const registryKey = getRegistryBinaryKey(name, platform);

        if (this.hasBinaryVersion(name, platform, version)) {
            return this.getBinaryPath(name, platform, version);
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

    public async installOsPackages(
        osName: OsName,
        version: OsVersion,
        installFn: (downloadProgressCallback: DownloadProgressCallback) => Promise<string>,
    ): Promise<string> {
        const registryKey = getRegistryOsPackagesKey(osName, version);

        if (this.hasOsPackages(osName, version)) {
            return this.getOsPackagesPath(osName, version);
        }

        browserInstallerDebug(`installing os packages for '${osName}@${version}'`);

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

    private readRegistry(): RegistryFileContents {
        const registry: RegistryFileContents = fs.existsSync(this.registryPath)
            ? fs.readJSONSync(this.registryPath)
            : {};

        registry.binaries ||= {} as Record<BinaryKey, VersionToPathMap>;
        registry.osPackages ||= {} as Record<OsPackagesKey, string>;
        registry.meta ||= { version: 1 };

        return registry;
    }

    private writeRegistry(): void {
        const replacer = (_: string, value: unknown): unknown | undefined => {
            if ((value as Promise<unknown>).then) {
                return;
            }

            return value;
        };

        fs.outputJSONSync(this.registryPath, this.registry, { replacer });
    }

    private addBinaryToRegistry(
        name: BinaryName,
        platform: BrowserPlatform,
        version: string,
        absoluteBinaryPath: string,
    ): void {
        const registryKey = getRegistryBinaryKey(name, platform);
        const relativePath = path.relative(this.registryPath, absoluteBinaryPath);

        this.registry.binaries[registryKey] ||= {};
        this.registry.binaries[registryKey][version] = relativePath;

        browserInstallerDebug(`adding '${name}@${version}' on '${platform}' to registry at ${relativePath}`);

        this.writeRegistry();
    }

    private addOsPackageToRegistry(name: OsName, version: OsVersion, absolutePackagesDirPath: string): void {
        const registryKey = getRegistryOsPackagesKey(name, version);
        const relativePath = path.relative(this.registryPath, absolutePackagesDirPath);

        this.registry.osPackages[registryKey] = relativePath;

        browserInstallerDebug(`adding os packages for '${name}@${version}' to registry at ${relativePath}`);

        this.writeRegistry();
    }

    private getBinaryVersions(name: BinaryName, platform: BrowserPlatform): string[] {
        const registryKey = getRegistryBinaryKey(name, platform);

        if (!this.registry.binaries[registryKey]) {
            return [];
        }

        return Object.keys(this.registry.binaries[registryKey]);
    }

    private hasBinaryVersion(name: BinaryName, platform: BrowserPlatform, version: string): boolean {
        return this.getBinaryVersions(name, platform).includes(version);
    }
}

export default new Registry();
