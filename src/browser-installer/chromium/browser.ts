import { install as puppeteerInstall, canDownload } from "@puppeteer/browsers";
import registry from "../registry";
import { getMilestone, browserInstallerDebug, getBrowsersDir, type DownloadProgressCallback } from "../utils";
import { getChromiumBuildId } from "./utils";
import { getChromePlatform } from "../utils";
import { MIN_CHROMIUM_VERSION } from "../constants";
import { BrowserName } from "../../browser/types";

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
    const existingLocallyBrowserVersion = registry.getMatchedBrowserVersion(BrowserName.CHROMIUM, platform, version);

    if (existingLocallyBrowserVersion && !force) {
        browserInstallerDebug(`A locally installed chromium@${version} browser was found. Skipping the installation`);

        return registry.getBinaryPath(BrowserName.CHROMIUM, platform, existingLocallyBrowserVersion);
    }

    const buildId = await getChromiumBuildId(platform, milestone);
    const cacheDir = getBrowsersDir();
    const canBeInstalled = await canDownload({ browser: BrowserName.CHROMIUM, platform, buildId, cacheDir });

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
            browser: BrowserName.CHROMIUM,
            unpack: true,
        }).then(result => result.executablePath);

    return registry.installBinary(BrowserName.CHROMIUM, platform, milestone, installFn);
};
