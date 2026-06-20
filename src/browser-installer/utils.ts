import { detectBrowserPlatform, BrowserPlatform, Browser as PuppeteerBrowser } from "@puppeteer/browsers";
import os from "os";
import path from "path";
import fs from "fs-extra";
import { execFile } from "child_process";
import { Readable } from "stream";
import debug from "debug";
import { promisify } from "util";
import { MIN_CHROMIUM_MAC_ARM_VERSION } from "./constants";
import type { BrowserName } from "../browser/types";

export type DownloadProgressCallback = (done: number, total?: number) => void;

export const browserInstallerDebug = debug("testplane:browser-installer");

const execFileAsync = promisify(execFile);

export const DriverName = {
    CHROMEDRIVER: PuppeteerBrowser.CHROMEDRIVER,
    GECKODRIVER: "geckodriver",
    SAFARIDRIVER: "safaridriver",
    EDGEDRIVER: "edgedriver",
} as const;

export type SupportedBrowser = (typeof BrowserName)[keyof typeof BrowserName];
export type SupportedDriver = (typeof DriverName)[keyof typeof DriverName];

export const createBrowserLabel = (browserName: string, version: string): string => browserName + "@" + version;

export const getMilestone = (version: string | number): string => {
    if (typeof version === "number") {
        return String(version);
    }

    return version.split(".")[0];
};

export const semverVersionsComparator = (a: string, b: string): number => {
    const splitVersion = (version: string): number[] =>
        version
            .replaceAll(/[^\d.]/g, "")
            .split(".")
            .filter(Boolean)
            .map(Number);

    const versionPartsA = splitVersion(a);
    const versionPartsB = splitVersion(b);

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

    return versionParts[0];
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

export const getBrowsersDir = (): string => path.join(getCacheDir(), "browsers");
const getDriversDir = (): string => path.join(getCacheDir(), "drivers");

const getDriverDir = (driverName: string, driverVersion: string): string =>
    path.join(getDriversDir(), driverName, driverVersion);

export const getOsPackagesDir = (osName: string, osVersion: string): string =>
    path.join(getCacheDir(), "packages", osName, osVersion);

export const getGeckoDriverDir = (driverVersion: string): string =>
    getDriverDir("geckodriver", getBrowserPlatform() + "-" + driverVersion);
export const getEdgeDriverDir = (driverVersion: string): string =>
    getDriverDir("edgedriver", getBrowserPlatform() + "-" + driverVersion);
export const getChromiumDriverDir = (driverVersion: string): string =>
    getDriverDir("chromedriver", getBrowserPlatform() + "-" + driverVersion);
export const getChromeDriverDir = (): string => getDriversDir(); // path is set by @puppeteer/browsers.install

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
    const writeStream = fs.createWriteStream(filePath);
    const response = await fetch(url);

    if (!response.ok || !response.body) {
        throw new Error(`Unable to download file from ${url}: ${response.statusText}`);
    }

    const stream = Readable.fromWeb(response.body as never).pipe(writeStream);

    return new Promise((resolve, reject) => {
        stream.on("error", reject);
        stream.on("close", resolve);
    });
};

export const unzipFile = async (zipPath: string, outputDir: string): Promise<string> => {
    await fs.ensureDir(outputDir);

    const windowsSystemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT ?? "C:\\Windows";

    // Mirrors @puppeteer/browsers native zip extraction:
    // https://github.com/puppeteer/puppeteer/blob/main/packages/browsers/src/fileUtil.ts#L195-L233
    const attempts =
        process.platform === "win32"
            ? [
                  {
                      command: path.win32.join(windowsSystemRoot, "System32", "tar.exe"),
                      args: ["-xf", zipPath, "-C", outputDir],
                  },
                  {
                      command: "powershell.exe",
                      args: [
                          "-NoProfile",
                          "-NonInteractive",
                          "-Command",
                          "& { Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force }",
                          zipPath,
                          outputDir,
                      ],
                  },
                  {
                      command: "pwsh.exe",
                      args: [
                          "-NoProfile",
                          "-NonInteractive",
                          "-Command",
                          "& { Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force }",
                          zipPath,
                          outputDir,
                      ],
                  },
              ]
            : [{ command: "unzip", args: ["-o", zipPath, "-d", outputDir] }];

    const errors: string[] = [];

    for (const attempt of attempts) {
        try {
            await execFileAsync(attempt.command, attempt.args, { windowsHide: true });

            return outputDir;
        } catch (err) {
            const error = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
            const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();

            errors.push(`${attempt.command} failed: ${error.message}${output ? `\n${output}` : ""}`);
        }
    }

    throw new Error(`Unable to unzip ${zipPath} to ${outputDir}:\n${errors.join("\n\n")}`);
};
