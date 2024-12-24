import _ from "lodash";
import { browserInstallerDebug, type SupportedBrowser } from "./utils";
import { getNormalizedBrowserName } from "../utils/browser";
import { BrowserName } from "../browser/types";

/**
 * @returns path to installed browser binary
 */
export const installBrowser = async (
    browserName: SupportedBrowser,
    browserVersion?: string,
    { force = false, shouldInstallWebDriver = false, shouldInstallUbuntuPackages = false } = {},
): Promise<string | null> => {
    if (!browserVersion) {
        throw new Error(
            `Couldn't install browser '${browserName}' because it has invalid version: '${browserVersion}'`,
        );
    }

    const { isUbuntu } = await import("./ubuntu-packages");

    const needUbuntuPackages = shouldInstallUbuntuPackages && (await isUbuntu());

    browserInstallerDebug(
        [
            `install ${browserName}@${browserVersion}`,
            `shouldInstallWebDriver:${shouldInstallWebDriver}`,
            `shouldInstallUbuntuPackages:${shouldInstallUbuntuPackages}`,
            `needUbuntuPackages:${needUbuntuPackages}`,
        ].join(", "),
    );

    switch (browserName) {
        case BrowserName.CHROME:
        case BrowserName.CHROMIUM: {
            const { installChrome } = await import("./chrome");

            return installChrome(browserVersion, { force, needUbuntuPackages, needWebDriver: shouldInstallWebDriver });
        }

        case BrowserName.FIREFOX: {
            const { installFirefox } = await import("./firefox");

            return installFirefox(browserVersion, { force, needUbuntuPackages, needWebDriver: shouldInstallWebDriver });
        }

        case BrowserName.EDGE: {
            const { installEdgeDriver } = await import("./edge");

            if (shouldInstallWebDriver) {
                await installEdgeDriver(browserVersion, { force });
            }

            return null;
        }

        case BrowserName.SAFARI: {
            return null;
        }
    }
};

export const BrowserInstallStatus = {
    Ok: "ok",
    Skip: "skip",
    Error: "error",
} as const;

type InstallResultSuccess = { status: "ok" };
type InstallResultSkip = { status: "skip"; reason: string };
type InstallResultError = { status: "error"; reason: string };

export type InstallResult<Status = unknown> = (InstallResultSuccess | InstallResultSkip | InstallResultError) & {
    status: Status;
};

type ForceInstallBinaryResult = Promise<InstallResult>;

const forceInstallBinaries = async (
    installFn: typeof installBrowser,
    browserName?: string,
    browserVersion?: string,
): ForceInstallBinaryResult => {
    const normalizedBrowserName = getNormalizedBrowserName(browserName);
    const installOpts = { force: true, shouldInstallWebDriver: true, shouldInstallUbuntuPackages: true };

    if (!normalizedBrowserName) {
        return {
            status: BrowserInstallStatus.Error,
            reason: `Installing ${browserName} is unsupported. Supported browsers: "chrome", "firefox", "safari", "edge"`,
        };
    }

    return installFn(normalizedBrowserName, browserVersion, installOpts)
        .then(successResult => {
            return successResult
                ? { status: BrowserInstallStatus.Ok }
                : {
                      status: BrowserInstallStatus.Skip,
                      reason: `Installing ${browserName} is unsupported. Assuming it is installed locally`,
                  };
        })
        .catch(errorResult => ({ status: BrowserInstallStatus.Error, reason: (errorResult as Error).message }));
};

export const installBrowsersWithDrivers = async (
    browsersToInstall: { browserName?: string; browserVersion?: string }[],
): Promise<Record<string, Awaited<ForceInstallBinaryResult>>> => {
    const uniqBrowsers = _.uniqBy(browsersToInstall, b => `${b.browserName}@${b.browserVersion}`);
    const installPromises = [] as Promise<void>[];
    const browsersInstallResult: Record<string, Awaited<ForceInstallBinaryResult>> = {};

    for (const { browserName, browserVersion } of uniqBrowsers) {
        installPromises.push(
            forceInstallBinaries(installBrowser, browserName, browserVersion).then(result => {
                browsersInstallResult[`${browserName}@${browserVersion}`] = result;
            }),
        );
    }

    await Promise.all(installPromises);

    return browsersInstallResult;
};
