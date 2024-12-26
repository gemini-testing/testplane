import _ from "lodash";
import { resolveBuildId, canDownload, install as puppeteerInstall } from "@puppeteer/browsers";
import { CHROME_FOR_TESTING_LATEST_STABLE_API_URL, MIN_CHROME_FOR_TESTING_VERSION } from "../constants";
import {
    browserInstallerDebug,
    getBrowserPlatform,
    getBrowsersDir,
    getMilestone,
    retryFetch,
    type DownloadProgressCallback,
} from "../utils";
import registry from "../registry";
import { normalizeChromeVersion } from "../utils";
import { installUbuntuPackageDependencies } from "../ubuntu-packages";
import { installChromeDriver } from "./driver";
import { BrowserName } from "../../browser/types";

const installChromeBrowser = async (version: string, { force = false } = {}): Promise<string> => {
    const milestone = getMilestone(version);

    if (Number(milestone) < MIN_CHROME_FOR_TESTING_VERSION) {
        browserInstallerDebug(`couldn't install chrome@${version}, installing chromium instead`);

        const { installChromium } = await import("../chromium");

        return installChromium(version, { force });
    }

    const platform = getBrowserPlatform();
    const existingLocallyBrowserVersion = registry.getMatchedBrowserVersion(BrowserName.CHROME, platform, version);

    if (existingLocallyBrowserVersion && !force) {
        browserInstallerDebug(`A locally installed chrome@${version} browser was found. Skipping the installation`);

        return registry.getBinaryPath(BrowserName.CHROME, platform, existingLocallyBrowserVersion);
    }

    const normalizedVersion = normalizeChromeVersion(version);
    const buildId = await resolveBuildId(BrowserName.CHROME, platform, normalizedVersion);

    const cacheDir = getBrowsersDir();
    const canBeInstalled = await canDownload({ browser: BrowserName.CHROME, platform, buildId, cacheDir });

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
            browser: BrowserName.CHROME,
            unpack: true,
        }).then(result => result.executablePath);

    return registry.installBinary(BrowserName.CHROME, platform, buildId, installFn);
};

export const installChrome = async (
    version: string,
    { force = false, needWebDriver = false, needUbuntuPackages = false } = {},
): Promise<string> => {
    const [browserPath] = await Promise.all([
        installChromeBrowser(version, { force }),
        needWebDriver && installChromeDriver(version, { force }),
        needUbuntuPackages && installUbuntuPackageDependencies(),
    ]);

    return browserPath;
};

export const resolveLatestChromeVersion = _.memoize(async (force = false): Promise<string> => {
    if (!force) {
        const platform = getBrowserPlatform();
        const existingLocallyBrowserVersion = registry.getMatchedBrowserVersion(BrowserName.CHROME, platform);

        if (existingLocallyBrowserVersion) {
            return existingLocallyBrowserVersion;
        }
    }

    return retryFetch(CHROME_FOR_TESTING_LATEST_STABLE_API_URL)
        .then(res => res.text())
        .catch(() => {
            throw new Error("Couldn't resolve latest chrome version");
        });
});
