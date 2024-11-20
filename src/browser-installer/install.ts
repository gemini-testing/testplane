import _ from "lodash";

/**
 * @returns path to browser binary
 */
export const installBrowser = async (
    browserName?: string,
    browserVersion?: string,
    { force = false, installWebDriver = false } = {},
): Promise<string | null> => {
    const unsupportedBrowserError = new Error(
        [
            `Couldn't install browser '${browserName}', as it is not supported`,
            `Currently supported for installation browsers: 'chrome', 'firefox`,
        ].join("\n"),
    );

    if (!browserName) {
        throw unsupportedBrowserError;
    }

    if (!browserVersion) {
        throw new Error(
            `Couldn't install browser '${browserName}' because it has invalid version: '${browserVersion}'`,
        );
    }

    if (/chrome/i.test(browserName)) {
        const { installChrome, installChromeDriver } = await import("./chrome");

        return installWebDriver
            ? await Promise.all([
                  installChrome(browserVersion, { force }),
                  installChromeDriver(browserVersion, { force }),
              ]).then(binaries => binaries[0])
            : installChrome(browserVersion, { force });
    } else if (/firefox/i.test(browserName)) {
        const { installFirefox, installLatestGeckoDriver } = await import("./firefox");

        return installWebDriver
            ? await Promise.all([
                  installFirefox(browserVersion, { force }),
                  installLatestGeckoDriver(browserVersion, { force }),
              ]).then(binaries => binaries[0])
            : installFirefox(browserVersion, { force });
    } else if (/edge/i.test(browserName)) {
        const { installEdgeDriver } = await import("./edge");

        if (installWebDriver) {
            await installEdgeDriver(browserVersion, { force });
        }

        return null;
    } else if (/safari/i.test(browserName)) {
        return null;
    }

    throw unsupportedBrowserError;
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
    return installFn(browserName, browserVersion, { force: true, installWebDriver: true })
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
