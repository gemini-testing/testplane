import { resolveBuildId, install as puppeteerInstall, canDownload } from "@puppeteer/browsers";
import { MIN_CHROMEDRIVER_FOR_TESTING_VERSION } from "../constants";
import {
    browserInstallerDebug,
    getBrowserPlatform,
    getChromeDriverDir,
    getMilestone,
    DriverName,
    type DownloadProgressCallback,
} from "../utils";
import registry from "../registry";

export const installChromeDriver = async (chromeVersion: string, { force = false } = {}): Promise<string> => {
    const platform = getBrowserPlatform();
    const existingLocallyDriverVersion = registry.getMatchedDriverVersion(
        DriverName.CHROMEDRIVER,
        platform,
        chromeVersion,
    );

    if (existingLocallyDriverVersion && !force) {
        browserInstallerDebug(
            `A locally installed chromedriver for chrome@${chromeVersion} was found. Skipping the installation`,
        );

        return registry.getBinaryPath(DriverName.CHROMEDRIVER, platform, existingLocallyDriverVersion);
    }

    const milestone = getMilestone(chromeVersion);

    if (Number(milestone) < MIN_CHROMEDRIVER_FOR_TESTING_VERSION) {
        browserInstallerDebug(
            `installing chromedriver for chrome@${chromeVersion} from chromedriver.storage.googleapis.com manually`,
        );

        const { installChromeDriverManually } = await import("../chromium");

        return installChromeDriverManually(milestone);
    }

    const buildId = await resolveBuildId(DriverName.CHROMEDRIVER, platform, milestone);

    const cacheDir = getChromeDriverDir();
    const canBeInstalled = await canDownload({ browser: DriverName.CHROMEDRIVER, platform, buildId, cacheDir });

    if (!canBeInstalled) {
        throw new Error(
            [
                `chromedriver@${buildId} can't be installed.`,
                `Probably the major browser version '${milestone}' is invalid`,
                "Correct chrome version examples: '123', '124'",
            ].join("\n"),
        );
    }

    const installFn = (downloadProgressCallback: DownloadProgressCallback): Promise<string> =>
        puppeteerInstall({
            platform,
            buildId,
            cacheDir: getChromeDriverDir(),
            browser: DriverName.CHROMEDRIVER,
            unpack: true,
            downloadProgressCallback,
        }).then(result => result.executablePath);

    return registry.installBinary(DriverName.CHROMEDRIVER, platform, buildId, installFn);
};
