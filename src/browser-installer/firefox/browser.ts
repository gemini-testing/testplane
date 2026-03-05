import _ from "lodash";
import { canDownload, install as puppeteerInstall } from "@puppeteer/browsers";
import {
    browserInstallerDebug,
    getBrowserPlatform,
    getBrowsersDir,
    retryFetch,
    type DownloadProgressCallback,
} from "../utils";
import registry from "../registry";
import { getFirefoxBuildId, normalizeFirefoxVersion } from "./utils";
import { installLatestGeckoDriver } from "./driver";
import { installUbuntuPackageDependencies } from "../ubuntu-packages";
import { BrowserName } from "../../browser/types";
import { FIREFOX_VERSIONS_LATEST_VERSIONS_API_URL } from "../constants";

const installFirefoxBrowser = async (version: string, { force = false } = {}): Promise<string> => {
    const platform = getBrowserPlatform();
    const existingLocallyBrowserVersion = registry.getMatchedBrowserVersion(BrowserName.FIREFOX, platform, version);

    if (existingLocallyBrowserVersion && !force) {
        browserInstallerDebug(`A locally installed firefox@${version} browser was found. Skipping the installation`);

        return registry.getBinaryPath(BrowserName.FIREFOX, platform, existingLocallyBrowserVersion);
    }

    const normalizedVersion = normalizeFirefoxVersion(version);
    const buildId = getFirefoxBuildId(normalizedVersion);

    const cacheDir = getBrowsersDir();
    const canBeInstalled = await canDownload({ browser: BrowserName.FIREFOX, platform, buildId, cacheDir });

    if (!canBeInstalled) {
        const lines: string[] = [];

        lines.push(`Failed to install Firefox@${version}.`);
        lines.push(
            "\nTestplane checked the Firefox download registry and found no binary matching the requested version.",
        );

        lines.push(
            "\nPossible reasons:",
            `- The version '${version}' does not exist in Firefox releases`,
            "- The version string format is incorrect",
            `- Firefox versions below 60 are not supported by the automatic installer`,
        );

        lines.push(
            "\nWhat you can do:",
            "- Use a valid Firefox version such as '120', '130.0', or '131.0'",
            "- Check available versions at: https://releases.mozilla.org/pub/firefox/releases/",
            "- Omit browserVersion in config to have Testplane install the latest stable Firefox automatically",
        );

        throw new Error(lines.join("\n"));
    }

    browserInstallerDebug(`installing firefox@${buildId} for ${platform}`);

    const installFn = (downloadProgressCallback: DownloadProgressCallback): Promise<string> =>
        puppeteerInstall({
            platform,
            buildId,
            cacheDir,
            downloadProgressCallback,
            browser: BrowserName.FIREFOX,
            unpack: true,
        }).then(result => result.executablePath);

    return registry.installBinary(BrowserName.FIREFOX, platform, buildId, installFn);
};

export const installFirefox = async (
    version: string,
    { force = false, needWebDriver = false, needUbuntuPackages = false } = {},
): Promise<string> => {
    const [browserPath] = await Promise.all([
        installFirefoxBrowser(version, { force }),
        needWebDriver && installLatestGeckoDriver(version, { force }),
        needUbuntuPackages && installUbuntuPackageDependencies(),
    ]);

    return browserPath;
};

export const resolveLatestFirefoxVersion = _.memoize(async (force = false): Promise<string> => {
    if (!force) {
        const platform = getBrowserPlatform();
        const existingLocallyBrowserVersion = registry.getMatchedBrowserVersion(BrowserName.FIREFOX, platform);

        if (existingLocallyBrowserVersion) {
            return existingLocallyBrowserVersion;
        }
    }

    return retryFetch(FIREFOX_VERSIONS_LATEST_VERSIONS_API_URL)
        .then(res => res.json())
        .then(({ LATEST_FIREFOX_VERSION }) => LATEST_FIREFOX_VERSION)
        .catch(() => {
            const lines: string[] = [];

            lines.push("Failed to resolve the latest Firefox version.");
            lines.push(
                "\nTestplane tried to fetch the latest Firefox version from:",
                `  ${FIREFOX_VERSIONS_LATEST_VERSIONS_API_URL}`,
                "The request failed after multiple retries.",
            );

            lines.push(
                "\nPossible reasons:",
                "- No internet connection, or the network is behind a firewall/proxy that blocks external requests",
                "- The Mozilla Product Details API is temporarily unavailable",
                "- DNS resolution failed in this environment (e.g. a restricted CI container)",
            );

            lines.push(
                "\nWhat you can do:",
                '- Set an explicit Firefox version in the Testplane config (e.g. browserVersion: "130.0") to avoid this network request entirely',
                "- Check your network connectivity: try opening the URL above in a browser or running `curl` against it",
                "- If you are behind a proxy, make sure the HTTPS_PROXY / HTTP_PROXY environment variables are set",
            );

            throw new Error(lines.join("\n"));
        });
});
