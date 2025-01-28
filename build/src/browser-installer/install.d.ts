import { type SupportedBrowser } from "./utils";
/**
 * @returns path to installed browser binary
 */
export declare const installBrowser: (browserName: SupportedBrowser, browserVersion?: string, { force, shouldInstallWebDriver, shouldInstallUbuntuPackages }?: {
    force?: boolean | undefined;
    shouldInstallWebDriver?: boolean | undefined;
    shouldInstallUbuntuPackages?: boolean | undefined;
}) => Promise<string | null>;
export declare const BrowserInstallStatus: {
    readonly Ok: "ok";
    readonly Skip: "skip";
    readonly Error: "error";
};
type InstallResultSuccess = {
    status: "ok";
};
type InstallResultSkip = {
    status: "skip";
    reason: string;
};
type InstallResultError = {
    status: "error";
    reason: string;
};
export type InstallResult<Status = unknown> = (InstallResultSuccess | InstallResultSkip | InstallResultError) & {
    status: Status;
};
type ForceInstallBinaryResult = Promise<InstallResult>;
export declare const installBrowsersWithDrivers: (browsersToInstall: {
    browserName?: string;
    browserVersion?: string;
}[]) => Promise<Record<string, Awaited<ForceInstallBinaryResult>>>;
export {};
