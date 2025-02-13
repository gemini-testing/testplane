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
            throw new Error("Couldn't resolve latest firefox version");
        });
});
