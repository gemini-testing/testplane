import { detectBrowserPlatform, BrowserPlatform, Browser as PuppeteerBrowser } from "@puppeteer/browsers";
import extractZip from "extract-zip";
import os from "os";
import path from "path";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import debug from "debug";
import { MIN_CHROMIUM_MAC_ARM_VERSION } from "./constants";

export type DownloadProgressCallback = (downloadedBytes: number, totalBytes: number) => void;

export const browserInstallerDebug = debug("testplane:browser-installer");

export const Browser = {
    CHROME: PuppeteerBrowser.CHROME,
    CHROMIUM: PuppeteerBrowser.CHROMIUM,
    FIREFOX: PuppeteerBrowser.FIREFOX,
    SAFARI: "safari",
    EDGE: "MicrosoftEdge",
} as const;

export const Driver = {
    CHROMEDRIVER: PuppeteerBrowser.CHROMEDRIVER,
    GECKODRIVER: "geckodriver",
    SAFARIDRIVER: "safaridriver",
    EDGEDRIVER: "edgedriver",
} as const;

export type SupportedBrowser = (typeof Browser)[keyof typeof Browser];
export type SupportedDriver = (typeof Driver)[keyof typeof Driver];

export const getDriverNameForBrowserName = (browserName: SupportedBrowser): SupportedDriver | null => {
    if (browserName === Browser.CHROME || browserName === Browser.CHROMIUM) {
        return Driver.CHROMEDRIVER;
    }

    if (browserName === Browser.FIREFOX) {
        return Driver.GECKODRIVER;
    }

    if (browserName === Browser.SAFARI) {
        return Driver.SAFARIDRIVER;
    }

    if (browserName === Browser.EDGE) {
        return Driver.EDGEDRIVER;
    }

    return null;
};

export const createBrowserLabel = (browserName: string, version = "latest"): string => browserName + "@" + version;

export const getMilestone = (version: string | number): string => {
    if (typeof version === "number") {
        return String(version);
    }

    return version.split(".")[0];
};

export const semverVersionsComparator = (a: string, b: string): number => {
    const versionPartsA = a
        .replaceAll(/[^\d.]/g, "")
        .split(".")
        .filter(Boolean)
        .map(Number);
    const versionPartsB = b
        .replaceAll(/[^\d.]/g, "")
        .split(".")
        .filter(Boolean)
        .map(Number);

    for (let i = 0; i < Math.min(versionPartsA.length, versionPartsB.length); i++) {
        if (versionPartsA[i] !== versionPartsB[i]) {
            return versionPartsA[i] - versionPartsB[i];
        }
    }

    return 0;
};

export const normalizeChromeVersion = (version: string): string => {
    const versionParts = version.split(".").filter(Boolean);

    if (versionParts.length === 2) {
        return versionParts[0];
    }

    if (versionParts.length >= 3) {
        return versionParts.slice(0, 3).join(".");
    }

    return getMilestone(version);
};

export const getBrowserPlatform = (): BrowserPlatform => {
    const platform = detectBrowserPlatform();

    if (!platform) {
        throw new Error(`Got an error while trying to download browsers: platform "${platform}" is not supported`);
    }

    return platform;
};

export const getChromePlatform = (version: string): BrowserPlatform => {
    const milestone = getMilestone(version);
    const platform = getBrowserPlatform();

    if (platform === BrowserPlatform.MAC_ARM && Number(milestone) < MIN_CHROMIUM_MAC_ARM_VERSION) {
        return BrowserPlatform.MAC;
    }

    return platform;
};

const resolveUserPath = (userPath: string): string =>
    userPath.startsWith("~") ? path.resolve(os.homedir(), userPath.slice(1)) : path.resolve(userPath);

const getCacheDir = (envValueOverride = process.env.TESTPLANE_BROWSERS_PATH): string =>
    envValueOverride ? resolveUserPath(envValueOverride) : path.join(os.homedir(), ".testplane");

export const getRegistryPath = (envValueOverride?: string): string =>
    path.join(getCacheDir(envValueOverride), "registry.json");

const getBrowsersDir = (): string => path.join(getCacheDir(), "browsers");
const getDriversDir = (): string => path.join(getCacheDir(), "drivers");

const getDriverDir = (driverName: string, driverVersion: string): string =>
    path.join(getDriversDir(), driverName, driverVersion);

export const getGeckoDriverDir = (driverVersion: string): string =>
    getDriverDir("geckodriver", getBrowserPlatform() + "-" + driverVersion);
export const getEdgeDriverDir = (driverVersion: string): string =>
    getDriverDir("edgedriver", getBrowserPlatform() + "-" + driverVersion);
export const getChromiumDriverDir = (driverVersion: string): string =>
    getDriverDir("chromedriver", getBrowserPlatform() + "-" + driverVersion);
export const getChromeDriverDir = (): string => getDriversDir(); // path is set by @puppeteer/browsers.install

export const getFirefoxBrowserDir = (): string => getBrowsersDir(); // path is set by @puppeteer/browsers.install
export const getChromeBrowserDir = (): string => getBrowsersDir(); // path is set by @puppeteer/browsers.install

export const retryFetch = async (
    url: Parameters<typeof fetch>[0],
    opts?: Parameters<typeof fetch>[1],
    retry = 3,
    retryDelay = 100,
): ReturnType<typeof fetch> => {
    while (retry > 0) {
        try {
            return await fetch(url, opts);
        } catch (e) {
            retry = retry - 1;

            if (retry <= 0) {
                throw e;
            }

            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    return null as never;
};

export const downloadFile = async (url: string, filePath: string): Promise<void> => {
    const writeStream = createWriteStream(filePath);
    const response = await fetch(url);

    if (!response.ok || !response.body) {
        throw new Error(`Unable to download file from ${url}`);
    }

    const stream = Readable.fromWeb(response.body as never).pipe(writeStream);

    return new Promise((resolve, reject) => {
        stream.on("error", reject);
        stream.on("close", resolve);
    });
};

export const unzipFile = async (zipPath: string, outputDir: string): Promise<string> => {
    await extractZip(zipPath, { dir: outputDir });

    return outputDir;
};
