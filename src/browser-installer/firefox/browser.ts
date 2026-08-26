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
import { FIREFOX_VERSIONS_LATEST_VERSIONS_API_URL, FIREFOX_VERSIONS_LATEST_VERSIONS_FILENAME } from "../constants";
import type { BrowserDownloadMirrors } from "../../config/types";
import {
    getBrowserDownloadMirror,
    getBrowserDownloadMirrorFileUrl,
    sanitizeBrowserDownloadMirrorError,
} from "../mirrors";

const installFirefoxBrowser = async (
    version: string,
    {
        force = false,
        browserDownloadMirrors,
    }: { force?: boolean; browserDownloadMirrors?: BrowserDownloadMirrors } = {},
): Promise<string> => {
    const platform = getBrowserPlatform();
    const existingLocallyBrowserVersion = registry.getMatchedBrowserVersion(BrowserName.FIREFOX, platform, version);

    if (existingLocallyBrowserVersion && !force) {
        browserInstallerDebug(`A locally installed firefox@${version} browser was found. Skipping the installation`);

        return registry.getBinaryPath(BrowserName.FIREFOX, platform, existingLocallyBrowserVersion);
    }

    const normalizedVersion = normalizeFirefoxVersion(version);
    const buildId = getFirefoxBuildId(normalizedVersion);

    const cacheDir = getBrowsersDir();
    const mirror = getBrowserDownloadMirror(BrowserName.FIREFOX, browserDownloadMirrors);
    const canBeInstalled = await canDownload({
        browser: BrowserName.FIREFOX,
        platform,
        buildId,
        cacheDir,
        baseUrl: mirror,
    });

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
            browser: BrowserName.FIREFOX,
            baseUrl: mirror,
            unpack: true,
        })
            .then(result => result.executablePath)
            .catch(error => {
                throw sanitizeBrowserDownloadMirrorError(error, mirror);
            });

    return registry.installBinary(BrowserName.FIREFOX, platform, buildId, installFn);
};

export const installFirefox = async (
    version: string,
    {
        force = false,
        needWebDriver = false,
        needUbuntuPackages = false,
        browserDownloadMirrors,
    }: {
        force?: boolean;
        needWebDriver?: boolean;
        needUbuntuPackages?: boolean;
        browserDownloadMirrors?: BrowserDownloadMirrors;
    } = {},
): Promise<string> => {
    const [browserPath] = await Promise.all([
        installFirefoxBrowser(version, { force, browserDownloadMirrors }),
        needWebDriver && installLatestGeckoDriver(version, { force }),
        needUbuntuPackages && installUbuntuPackageDependencies(),
    ]);

    return browserPath;
};

export const resolveLatestFirefoxVersion = _.memoize(
    async (force = false, browserDownloadMirrors?: BrowserDownloadMirrors): Promise<string> => {
        if (!force) {
            const platform = getBrowserPlatform();
            const existingLocallyBrowserVersion = registry.getMatchedBrowserVersion(BrowserName.FIREFOX, platform);

            if (existingLocallyBrowserVersion) {
                return existingLocallyBrowserVersion;
            }
        }

        const mirror = getBrowserDownloadMirror(BrowserName.FIREFOX, browserDownloadMirrors);
        const latestVersionsUrl = mirror
            ? getBrowserDownloadMirrorFileUrl(mirror, FIREFOX_VERSIONS_LATEST_VERSIONS_FILENAME)
            : FIREFOX_VERSIONS_LATEST_VERSIONS_API_URL;

        return retryFetch(latestVersionsUrl)
            .then(res => res.json())
            .then(({ LATEST_FIREFOX_VERSION }) => LATEST_FIREFOX_VERSION)
            .catch(() => {
                throw new Error("Couldn't resolve latest firefox version");
            });
    },
    (force, browserDownloadMirrors) =>
        `${force}:${getBrowserDownloadMirror(BrowserName.FIREFOX, browserDownloadMirrors) ?? "default"}`,
);
