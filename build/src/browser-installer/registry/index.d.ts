import type { BrowserPlatform } from "@puppeteer/browsers";
import { type SupportedBrowser, type SupportedDriver, type DownloadProgressCallback } from "../utils";
type VersionToPathMap = Record<string, string | Promise<string>>;
type BinaryName = Exclude<SupportedBrowser | SupportedDriver, SupportedBrowser & SupportedDriver>;
type BinaryKey = `${BinaryName}_${BrowserPlatform}`;
type OsName = string;
type OsVersion = string;
type OsPackagesKey = `${OsName}_${OsVersion}`;
export type RegistryFileContents = {
    binaries: Record<BinaryKey, VersionToPathMap>;
    osPackages: Record<OsPackagesKey, string | Promise<string>>;
    meta: {
        version: number;
    };
};
declare class Registry {
    private registryPath;
    private registry;
    getBinaryPath(name: BinaryName, platform: BrowserPlatform, version: string): Promise<string>;
    getOsPackagesPath(name: OsName, version: OsVersion): Promise<string>;
    hasOsPackages(name: OsName, version: OsVersion): boolean;
    getMatchedDriverVersion(driverName: SupportedDriver, platform: BrowserPlatform, browserVersion: string): string | null;
    getMatchedBrowserVersion(browserName: SupportedBrowser, platform: BrowserPlatform, browserVersion?: string): string | null;
    installBinary(name: BinaryName, platform: BrowserPlatform, version: string, installFn: (downloadProgressCallback: DownloadProgressCallback) => Promise<string>): Promise<string>;
    installOsPackages(osName: OsName, version: OsVersion, installFn: (downloadProgressCallback: DownloadProgressCallback) => Promise<string>): Promise<string>;
    private readRegistry;
    private writeRegistry;
    private addBinaryToRegistry;
    private addOsPackageToRegistry;
    private getBinaryVersions;
    private hasBinaryVersion;
}
declare const _default: Registry;
export default _default;
