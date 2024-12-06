import _ from "lodash";
import { Browser, getNormalizedBrowserName, type SupportedBrowser } from "./utils";

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

    const { isUbuntu, installUbuntuPackageDependencies } = await import("./ubuntu-packages");

    const needToInstallUbuntuPackages = shouldInstallUbuntuPackages && (await isUbuntu());

    switch (browserName) {
        case Browser.CHROME:
        case Browser.CHROMIUM: {
            const { installChrome, installChromeDriver } = await import("./chrome");

            const [browserPath] = await Promise.all([
                installChrome(browserVersion, { force }),
                shouldInstallWebDriver && installChromeDriver(browserVersion, { force }),
                needToInstallUbuntuPackages && installUbuntuPackageDependencies(),
            ]);

            return browserPath;
        }

        case Browser.FIREFOX: {
            const { installFirefox, installLatestGeckoDriver } = await import("./firefox");

            const [browserPath] = await Promise.all([
                installFirefox(browserVersion, { force }),
                shouldInstallWebDriver && installLatestGeckoDriver(browserVersion, { force }),
                needToInstallUbuntuPackages && installUbuntuPackageDependencies(),
            ]);

            return browserPath;
        }

        case Browser.EDGE: {
            const { installEdgeDriver } = await import("./edge");

            if (shouldInstallWebDriver) {
                await installEdgeDriver(browserVersion, { force });
            }

            return null;
        }

        case Browser.SAFARI: {
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

    if (!normalizedBrowserName) {
        return {
            status: BrowserInstallStatus.Error,
            reason: `Installing ${browserName} is unsupported. Supported browsers: "chrome", "firefox", "safari", "edge"`,
        };
    }

    return installFn(normalizedBrowserName, browserVersion, { force: true, shouldInstallWebDriver: true })
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
