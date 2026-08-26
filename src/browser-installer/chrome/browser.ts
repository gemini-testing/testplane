import _ from "lodash";
import { resolveBuildId, canDownload, install as puppeteerInstall } from "@puppeteer/browsers";
import {
    CHROME_FOR_TESTING_LATEST_STABLE_API_URL,
    CHROME_FOR_TESTING_LATEST_STABLE_FILENAME,
    MIN_CHROME_FOR_TESTING_VERSION,
} from "../constants";
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
import type { BrowserDownloadMirrors } from "../../config/types";
import {
    getBrowserDownloadMirror,
    getBrowserDownloadMirrorFileUrl,
    sanitizeBrowserDownloadMirrorError,
} from "../mirrors";
import { resolveChromeBuildIdFromMirror, type ChromeBuildIdResolver } from "./utils";

const createChromeBuildIdResolver = (version: string): ChromeBuildIdResolver => {
    let buildIdPromise: Promise<string> | undefined;

    return (mirror: string): Promise<string> => {
        buildIdPromise ??= resolveChromeBuildIdFromMirror(version, mirror);

        return buildIdPromise;
    };
};

const installChromeBrowser = async (
    browserName: typeof BrowserName.CHROME | typeof BrowserName.CHROMEHEADLESSSHELL,
    version: string,
    {
        force = false,
        browserDownloadMirrors,
        resolveMirrorBuildId,
    }: {
        force?: boolean;
        browserDownloadMirrors?: BrowserDownloadMirrors;
        resolveMirrorBuildId?: ChromeBuildIdResolver;
    } = {},
): Promise<string> => {
    const milestone = getMilestone(version);

    if (Number(milestone) < MIN_CHROME_FOR_TESTING_VERSION) {
        browserInstallerDebug(`couldn't install chrome@${version}, installing chromium instead`);

        const { installChromium } = await import("../chromium");

        return installChromium(version, { force, browserDownloadMirrors });
    }

    const platform = getBrowserPlatform();
    const existingLocallyBrowserVersion = registry.getMatchedBrowserVersion(browserName, platform, version);

    if (existingLocallyBrowserVersion && !force) {
        browserInstallerDebug(`A locally installed chrome@${version} browser was found. Skipping the installation`);

        return registry.getBinaryPath(browserName, platform, existingLocallyBrowserVersion);
    }

    const normalizedVersion = normalizeChromeVersion(version);
    const mirror = getBrowserDownloadMirror(browserName, browserDownloadMirrors);
    const buildId = mirror
        ? await (resolveMirrorBuildId ? resolveMirrorBuildId(mirror) : resolveChromeBuildIdFromMirror(version, mirror))
        : await resolveBuildId(browserName, platform, normalizedVersion);

    const cacheDir = getBrowsersDir();
    const canBeInstalled = await canDownload({ browser: browserName, platform, buildId, cacheDir, baseUrl: mirror });

    if (!canBeInstalled) {
        throw new Error(
            [
                `${browserName}@${version} can't be installed.`,
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
            browser: browserName,
            baseUrl: mirror,
            unpack: true,
        })
            .then(result => result.executablePath)
            .catch(error => {
                throw sanitizeBrowserDownloadMirrorError(error, mirror);
            });

    return registry.installBinary(browserName, platform, buildId, installFn);
};

export const installChrome = async (
    browserName: typeof BrowserName.CHROME | typeof BrowserName.CHROMEHEADLESSSHELL,
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
    const resolveMirrorBuildId =
        browserDownloadMirrors?.chrome === null || browserDownloadMirrors?.chrome === undefined
            ? undefined
            : createChromeBuildIdResolver(version);
    const [browserPath] = await Promise.all([
        installChromeBrowser(browserName, version, { force, browserDownloadMirrors, resolveMirrorBuildId }),
        needWebDriver &&
            installChromeDriver(version, {
                force,
                ...(browserDownloadMirrors && { browserDownloadMirrors }),
                ...(resolveMirrorBuildId && { resolveMirrorBuildId }),
            }),
        needUbuntuPackages && installUbuntuPackageDependencies(),
    ]);

    return browserPath;
};

export const resolveLatestChromeVersion = _.memoize(
    async (force = false, browserDownloadMirrors?: BrowserDownloadMirrors): Promise<string> => {
        if (!force) {
            const platform = getBrowserPlatform();
            const existingLocallyBrowserVersion = registry.getMatchedBrowserVersion(BrowserName.CHROME, platform);

            if (existingLocallyBrowserVersion) {
                return existingLocallyBrowserVersion;
            }
        }

        const mirror = getBrowserDownloadMirror(BrowserName.CHROME, browserDownloadMirrors);
        const latestStableUrl = mirror
            ? getBrowserDownloadMirrorFileUrl(mirror, CHROME_FOR_TESTING_LATEST_STABLE_FILENAME)
            : CHROME_FOR_TESTING_LATEST_STABLE_API_URL;

        return retryFetch(latestStableUrl)
            .then(res => res.text())
            .then(version => version.trim())
            .catch(() => {
                throw new Error("Couldn't resolve latest chrome version");
            });
    },
    (force, browserDownloadMirrors) =>
        `${force}:${getBrowserDownloadMirror(BrowserName.CHROME, browserDownloadMirrors) ?? "default"}`,
);
