import { canDownload, install as puppeteerInstall } from "@puppeteer/browsers";
import {
    Browser,
    browserInstallerDebug,
    getBrowserPlatform,
    getFirefoxBrowserDir,
    type DownloadProgressCallback,
} from "../utils";
import { installBinary, getBinaryPath, getMatchingBrowserVersion } from "../registry";
import { getFirefoxBuildId, normalizeFirefoxVersion } from "./utils";

export const installFirefox = async (version: string, { force = false } = {}): Promise<string> => {
    const platform = getBrowserPlatform();
    const existingLocallyBrowserVersion = getMatchingBrowserVersion(Browser.FIREFOX, platform, version);

    if (existingLocallyBrowserVersion && !force) {
        browserInstallerDebug(`skip installing firefox@${version}`);

        return getBinaryPath(Browser.FIREFOX, platform, existingLocallyBrowserVersion);
    }

    const normalizedVersion = normalizeFirefoxVersion(version);
    const buildId = getFirefoxBuildId(normalizedVersion);

    const cacheDir = getFirefoxBrowserDir();
    const canBeInstalled = await canDownload({ browser: Browser.FIREFOX, platform, buildId, cacheDir });

    if (!canBeInstalled) {
        throw new Error(
            [
                `firefox@${version} can't be installed.`,
                `Probably the version '${version}' is invalid, please try another version.`,
                "Version examples: '120', '130.0', '131.0'",
            ].join("\n"),
        );
    }

    browserInstallerDebug(`installing firefox@${buildId} for ${platform}`);

    const installFn = (downloadProgressCallback: DownloadProgressCallback): Promise<string> =>
        puppeteerInstall({
            platform,
            buildId,
            cacheDir,
            downloadProgressCallback,
            browser: Browser.FIREFOX,
            unpack: true,
        }).then(result => result.executablePath);

    return installBinary(Browser.FIREFOX, platform, buildId, installFn);
};
