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
        case BrowserName.CHROMIUM:
        case BrowserName.CHROMEHEADLESSSHELL: {
            const { installChrome, resolveLatestChromeVersion } = await import("./chrome");
            const w3cBrowserName = browserName === BrowserName.CHROMIUM ? BrowserName.CHROME : browserName;
            const version = browserVersion || (await resolveLatestChromeVersion(force));

            return installChrome(w3cBrowserName, version, {
                force,
                needUbuntuPackages,
                needWebDriver: shouldInstallWebDriver,
            });
        }

        case BrowserName.FIREFOX: {
            const { installFirefox, resolveLatestFirefoxVersion } = await import("./firefox");
            const version = browserVersion || (await resolveLatestFirefoxVersion(force));

            return installFirefox(version, { force, needUbuntuPackages, needWebDriver: shouldInstallWebDriver });
        }

        case BrowserName.EDGE: {
            const { installEdgeDriver, resolveEdgeVersion } = await import("./edge");
            const version = browserVersion || (await resolveEdgeVersion());

            if (shouldInstallWebDriver) {
                await installEdgeDriver(version, { force });
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
                const key = browserVersion ? `${browserName}@${browserVersion}` : String(browserName);

                browsersInstallResult[key] = result;
            }),
        );
    }

    await Promise.all(installPromises);

    return browsersInstallResult;
};
