import { resolveBuildId, canDownload, install as puppeteerInstall } from "@puppeteer/browsers";
import { MIN_CHROME_FOR_TESTING_VERSION } from "../constants";
import {
    browserInstallerDebug,
    getBrowserPlatform,
    getBrowsersDir,
    getMilestone,
    Browser,
    type DownloadProgressCallback,
} from "../utils";
import { getBinaryPath, getMatchedBrowserVersion, installBinary } from "../registry";
import { normalizeChromeVersion } from "../utils";

export const installChrome = async (version: string, { force = false } = {}): Promise<string> => {
    const milestone = getMilestone(version);

    if (Number(milestone) < MIN_CHROME_FOR_TESTING_VERSION) {
        browserInstallerDebug(`couldn't install chrome@${version}, installing chromium instead`);

        const { installChromium } = await import("../chromium");

        return installChromium(version, { force });
    }

    const platform = getBrowserPlatform();
    const existingLocallyBrowserVersion = getMatchedBrowserVersion(Browser.CHROME, platform, version);

    if (existingLocallyBrowserVersion && !force) {
        browserInstallerDebug(`A locally installed chrome@${version} browser was found. Skipping the installation`);

        return getBinaryPath(Browser.CHROME, platform, existingLocallyBrowserVersion);
    }

    const normalizedVersion = normalizeChromeVersion(version);
    const buildId = await resolveBuildId(Browser.CHROME, platform, normalizedVersion);

    const cacheDir = getBrowsersDir();
    const canBeInstalled = await canDownload({ browser: Browser.CHROME, platform, buildId, cacheDir });

    if (!canBeInstalled) {
        throw new Error(
            [
                `chrome@${version} can't be installed.`,
                `Probably the version '${version}' is invalid, please try another version.`,
                "Version examples: '120', '120.0'",
            ].join("\n"),
        );
    }

    const installFn = (downloadProgressCallback: DownloadProgressCallback): Promise<string> =>
        puppeteerInstall({
            platform,
            buildId,
            cacheDir,
            downloadProgressCallback,
            browser: Browser.CHROME,
            unpack: true,
        }).then(result => result.executablePath);

    return installBinary(Browser.CHROME, platform, buildId, installFn);
};
