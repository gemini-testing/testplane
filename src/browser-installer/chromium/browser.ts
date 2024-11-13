import { install as puppeteerInstall, canDownload } from "@puppeteer/browsers";
import { installBinary, getBinaryPath, getMatchingBrowserVersion } from "../registry";
import {
    getMilestone,
    browserInstallerDebug,
    getChromeBrowserDir,
    Browser,
    type DownloadProgressCallback,
} from "../utils";
import { getChromiumBuildId } from "./utils";
import { getChromePlatform } from "../utils";
import { MIN_CHROMIUM_VERSION } from "../constants";

export const installChromium = async (version: string, { force = false } = {}): Promise<string> => {
    const milestone = getMilestone(version);

    if (Number(milestone) < MIN_CHROMIUM_VERSION) {
        throw new Error(
            [
                `chrome@${version} can't be installed.`,
                `Automatic browser downloader is not available for chrome versions < ${MIN_CHROMIUM_VERSION}`,
            ].join("\n"),
        );
    }

    const platform = getChromePlatform(version);
    const existingLocallyBrowserVersion = getMatchingBrowserVersion(Browser.CHROMIUM, platform, version);

    if (existingLocallyBrowserVersion && !force) {
        browserInstallerDebug(`skip installing chromium@${version}`);

        return getBinaryPath(Browser.CHROMIUM, platform, existingLocallyBrowserVersion);
    }

    const buildId = await getChromiumBuildId(platform, milestone);
    const cacheDir = getChromeBrowserDir();
    const canBeInstalled = await canDownload({ browser: Browser.CHROMIUM, platform, buildId, cacheDir });

    if (!canBeInstalled) {
        throw new Error(
            [
                `chrome@${version} can't be installed.`,
                `Probably the version '${version}' is invalid, please try another version.`,
                "Version examples: '93', '93.0'",
            ].join("\n"),
        );
    }

    browserInstallerDebug(`installing chromium@${buildId} (${milestone}) for ${platform}`);

    const installFn = (downloadProgressCallback: DownloadProgressCallback): Promise<string> =>
        puppeteerInstall({
            platform,
            buildId,
            cacheDir,
            downloadProgressCallback,
            browser: Browser.CHROMIUM,
            unpack: true,
        }).then(result => result.executablePath);

    return installBinary(Browser.CHROMIUM, platform, milestone, installFn);
};
