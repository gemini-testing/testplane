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
        const lines: string[] = [];

        lines.push(`Failed to install Chromium@${version}: version is too old.`);
        lines.push(
            `\nTestplane's automatic Chromium downloader only supports versions >= ${MIN_CHROMIUM_VERSION}.`,
            `The requested version '${version}' (milestone ${milestone}) is below this threshold.`,
        );

        lines.push(
            "\nWhat you can do:",
            `- Use Chromium version ${MIN_CHROMIUM_VERSION} or higher`,
            "- If you need an old browser for legacy testing, download it manually and point 'executablePath' to it in the config",
        );

        throw new Error(lines.join("\n"));
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
        const lines: string[] = [];

        lines.push(`Failed to install Chromium@${version}.`);
        lines.push(
            "\nTestplane checked the Chromium download registry and found no build matching the requested version.",
        );

        lines.push(
            "\nPossible reasons:",
            `- The version '${version}' does not exist in Chromium releases for the current platform`,
            "- The version string format is incorrect",
        );

        lines.push(
            "\nWhat you can do:",
            "- Use a milestone number like '93' or a milestone + minor like '93.0'",
            "- Browse available Chromium revisions at: https://commondatastorage.googleapis.com/chromium-browser-snapshots/index.html",
        );

        throw new Error(lines.join("\n"));
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
