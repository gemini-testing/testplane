import path from "path";
import { spawn } from "child_process";
import fs from "fs-extra";
import {
    Browser as PuppeteerBrowser,
    BrowserPlatform,
    canDownload,
    computeExecutablePath,
    detectBrowserPlatform,
    install as puppeteerInstall,
    resolveBuildId,
} from "@puppeteer/browsers";
import registry from "../src/browser-installer/registry";
import { getUbuntuMilestone, installUbuntuPackageDependencies, isUbuntu } from "../src/browser-installer/ubuntu-packages";
import { LINUX_UBUNTU_RELEASE_ID } from "../src/browser-installer/constants";
import {
    getBrowsersDir,
    getChromeDriverDir,
    getMilestone,
    getOsPackagesDir,
    getRegistryPath,
    normalizeChromeVersion,
    type DownloadProgressCallback,
} from "../src/browser-installer/utils";
import { BROWSER_NAME, BROWSER_VERSION } from "../test/integration/standalone/constants";

const LOG_PREFIX = "[preload-standalone-browser]";
const MAX_DIR_ENTRIES = 300;
const STEP_TIMEOUT_MS = 180_000;

const log = (message: string): void => {
    console.log(`${LOG_PREFIX} ${message}`);
};

const dumpJson = (label: string, value: unknown): void => {
    log(`${label}: ${JSON.stringify(value, null, 2)}`);
};

const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return String(bytes);
    }

    const units = ["B", "KiB", "MiB", "GiB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }

    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const getInstallDir = (executablePath: string): string => path.dirname(path.dirname(executablePath));

const getArchivePath = (cacheRoot: string, browser: PuppeteerBrowser, buildId: string, downloadUrl: string): string =>
    path.join(cacheRoot, browser, `${buildId}-${downloadUrl.split("/").pop()}`);

const getChromeForTestingPlatform = (platform: BrowserPlatform): string => {
    switch (platform) {
        case BrowserPlatform.LINUX:
            return "linux64";
        case BrowserPlatform.MAC:
            return "mac-x64";
        case BrowserPlatform.MAC_ARM:
            return "mac-arm64";
        case BrowserPlatform.WIN32:
            return "win32";
        case BrowserPlatform.WIN64:
            return "win64";
        default:
            return platform;
    }
};

const getChromeForTestingUrl = (browser: PuppeteerBrowser, platform: BrowserPlatform, buildId: string): string =>
    `https://storage.googleapis.com/chrome-for-testing-public/${buildId}/${getChromeForTestingPlatform(platform)}/${browser}-${getChromeForTestingPlatform(platform)}.zip`;

const runCommand = async (command: string, args: string[]): Promise<void> => {
    log(`running: ${command} ${args.join(" ")}`);

    await new Promise<void>((resolve, reject) => {
        const childProcess = spawn(command, args, { stdio: "inherit" });

        childProcess.on("error", reject);
        childProcess.on("exit", (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} exited with ${code === null ? `signal ${signal}` : `code ${code}`}`));
        });
    });
};

const dumpPath = async (label: string, targetPath: string): Promise<void> => {
    if (!(await fs.pathExists(targetPath))) {
        log(`${label}: missing at ${targetPath}`);
        return;
    }

    const stat = await fs.stat(targetPath);

    log(
        `${label}: exists at ${targetPath} (${stat.isDirectory() ? "directory" : "file"}, size=${stat.size}, mode=${stat.mode.toString(8)})`,
    );
};

const dumpDir = async (label: string, dirPath: string, maxDepth = 3): Promise<void> => {
    log(`${label}: ${dirPath}`);

    if (!(await fs.pathExists(dirPath))) {
        log("  <missing>");
        return;
    }

    let entriesCount = 0;

    const walk = async (currentPath: string, depth: number, indent: string): Promise<void> => {
        if (entriesCount >= MAX_DIR_ENTRIES) {
            return;
        }

        const entries = (await fs.readdir(currentPath)).sort();

        for (const entry of entries) {
            if (entriesCount >= MAX_DIR_ENTRIES) {
                log(`${indent}<truncated after ${MAX_DIR_ENTRIES} entries>`);
                return;
            }

            const entryPath = path.join(currentPath, entry);
            const stat = await fs.stat(entryPath);
            const suffix = stat.isDirectory() ? "/" : "";

            entriesCount++;
            log(`${indent}${entry}${suffix} size=${stat.size} mode=${stat.mode.toString(8)}`);

            if (stat.isDirectory() && depth < maxDepth) {
                await walk(entryPath, depth + 1, `${indent}  `);
            }
        }
    };

    await walk(dirPath, 0, "  ");

    if (entriesCount === 0) {
        log("  <empty>");
    }
};

const dumpRegistry = async (): Promise<void> => {
    const registryPath = getRegistryPath();

    await dumpPath("registry", registryPath);

    if (await fs.pathExists(registryPath)) {
        log(`registry contents:\n${await fs.readFile(registryPath, "utf8")}`);
    }
};

const runLoggedStep = async <T>(
    label: string,
    action: () => Promise<T>,
    dumpState: () => Promise<void>,
    timeoutMs = STEP_TIMEOUT_MS,
): Promise<T> => {
    const startedAt = Date.now();
    const progressTimer = setInterval(() => {
        log(`${label}: still running (${Math.round((Date.now() - startedAt) / 1000)}s elapsed)`);
    }, 10_000);
    const timeoutTimer = setTimeout(() => {
        clearInterval(progressTimer);
        console.error(`${LOG_PREFIX} ${label}: timed out after ${timeoutMs}ms`);

        void (async (): Promise<void> => {
            try {
                await dumpState();
            } finally {
                process.exit(1);
            }
        })();
    }, timeoutMs);

    try {
        log(`${label}: start`);
        const result = await action();

        log(`${label}: finished in ${Date.now() - startedAt}ms`);

        return result;
    } catch (err) {
        console.error(`${LOG_PREFIX} ${label}: failed after ${Date.now() - startedAt}ms`, err);
        throw err;
    } finally {
        clearTimeout(timeoutTimer);
        try {
            await dumpState();
        } finally {
            clearInterval(progressTimer);
        }
    }
};

const createDownloadProgressLogger = (
    label: string,
    downloadProgressCallback: DownloadProgressCallback,
): DownloadProgressCallback => {
    let lastLoggedPercent = -1;
    let lastLoggedAt = 0;

    return (done, total = 0) => {
        downloadProgressCallback(done, total);

        const now = Date.now();
        const percent = total > 0 ? Math.floor((done / total) * 100) : null;
        const shouldLog =
            percent === null
                ? now - lastLoggedAt >= 10_000
                : percent === 100 || percent >= lastLoggedPercent + 10 || now - lastLoggedAt >= 10_000;

        if (!shouldLog) {
            return;
        }

        lastLoggedAt = now;
        lastLoggedPercent = percent ?? lastLoggedPercent;

        log(
            `${label}: downloaded ${formatBytes(done)}${total > 0 ? ` / ${formatBytes(total)} (${percent}%)` : ""}`,
        );
    };
};

const installWithNativeUnzip = async ({
    browser,
    platform,
    buildId,
    cacheDir,
    installDir,
    executablePath,
    label,
    downloadProgressCallback,
}: {
    browser: PuppeteerBrowser;
    platform: BrowserPlatform;
    buildId: string;
    cacheDir: string;
    installDir: string;
    executablePath: string;
    label: string;
    downloadProgressCallback: DownloadProgressCallback;
}): Promise<string> => {
    const archivePath = await puppeteerInstall({
        browser,
        platform,
        buildId,
        cacheDir,
        unpack: false,
        downloadProgressCallback: createDownloadProgressLogger(label, downloadProgressCallback),
    });

    log(`${label}: downloaded archive ${archivePath}`);
    await fs.remove(installDir);
    await fs.ensureDir(installDir);
    await runCommand("unzip", ["-q", archivePath, "-d", installDir]);
    await fs.chmod(executablePath, 0o755);

    return executablePath;
};

async function preloadStandaloneBrowser(): Promise<void> {
    const browser = { browserName: BROWSER_NAME, browserVersion: BROWSER_VERSION };
    const platform = detectBrowserPlatform();

    if (!platform) {
        throw new Error("Unable to detect browser platform");
    }

    const browserTag = `${browser.browserName}@${browser.browserVersion}`;
    const chromeBuildId = await resolveBuildId(
        PuppeteerBrowser.CHROME,
        platform,
        normalizeChromeVersion(BROWSER_VERSION),
    );
    const chromeDriverBuildId = await resolveBuildId(
        PuppeteerBrowser.CHROMEDRIVER,
        platform,
        getMilestone(BROWSER_VERSION),
    );
    const chromeExecutablePath = computeExecutablePath({
        browser: PuppeteerBrowser.CHROME,
        buildId: chromeBuildId,
        cacheDir: getBrowsersDir(),
        platform,
    });
    const chromeDriverExecutablePath = computeExecutablePath({
        browser: PuppeteerBrowser.CHROMEDRIVER,
        buildId: chromeDriverBuildId,
        cacheDir: getChromeDriverDir(),
        platform,
    });
    const chromeInstallDir = getInstallDir(chromeExecutablePath);
    const chromeDriverInstallDir = getInstallDir(chromeDriverExecutablePath);
    const chromeCacheRoot = path.dirname(chromeInstallDir);
    const chromeDriverCacheRoot = path.dirname(chromeDriverInstallDir);
    const chromeDownloadUrl = getChromeForTestingUrl(PuppeteerBrowser.CHROME, platform, chromeBuildId);
    const chromeDriverDownloadUrl = getChromeForTestingUrl(
        PuppeteerBrowser.CHROMEDRIVER,
        platform,
        chromeDriverBuildId,
    );
    const chromeArchivePath = getArchivePath(getBrowsersDir(), PuppeteerBrowser.CHROME, chromeBuildId, chromeDownloadUrl);
    const chromeDriverArchivePath = getArchivePath(
        getChromeDriverDir(),
        PuppeteerBrowser.CHROMEDRIVER,
        chromeDriverBuildId,
        chromeDriverDownloadUrl,
    );
    const ubuntu = await isUbuntu();
    const ubuntuMilestone = ubuntu ? await getUbuntuMilestone() : null;
    const ubuntuPackagesDir = ubuntuMilestone ? getOsPackagesDir(LINUX_UBUNTU_RELEASE_ID, ubuntuMilestone) : null;

    dumpJson("environment", {
        node: process.version,
        cwd: process.cwd(),
        home: process.env.HOME,
        browser,
        platform,
        chromeBuildId,
        chromeDriverBuildId,
        browsersDir: getBrowsersDir(),
        chromeDriverDir: getChromeDriverDir(),
        registryPath: getRegistryPath(),
        chromeExecutablePath,
        chromeDriverExecutablePath,
        chromeDownloadUrl,
        chromeDriverDownloadUrl,
        chromeArchivePath,
        chromeDriverArchivePath,
        ubuntu,
        ubuntuMilestone,
        ubuntuPackagesDir,
    });

    await dumpRegistry();
    if (ubuntuPackagesDir) {
        await dumpDir("before ubuntu packages dir", ubuntuPackagesDir, 2);
    }
    await dumpDir("before chrome cache root", chromeCacheRoot, 2);
    await dumpDir("before chromedriver cache root", chromeDriverCacheRoot, 2);
    await dumpDir("before chrome install dir", chromeInstallDir);
    await dumpDir("before chromedriver install dir", chromeDriverInstallDir);
    await dumpPath("before chrome archive", chromeArchivePath);
    await dumpPath("before chromedriver archive", chromeDriverArchivePath);

    if (ubuntuPackagesDir) {
        await runLoggedStep(
            "ubuntu packages",
            installUbuntuPackageDependencies,
            async () => {
                await dumpRegistry();
                await dumpDir("after ubuntu packages dir", ubuntuPackagesDir, 2);
            },
        );
    } else {
        log("ubuntu packages: skipped, current OS is not Ubuntu");
    }

    log(`chrome binary ${chromeBuildId}: download URL ${chromeDownloadUrl}`);
    const chromeCanDownload = await runLoggedStep(
        `chrome binary ${chromeBuildId} availability`,
        () =>
            canDownload({
                browser: PuppeteerBrowser.CHROME,
                platform,
                buildId: chromeBuildId,
                cacheDir: getBrowsersDir(),
            }),
        async () => {
            await dumpPath("chrome archive", chromeArchivePath);
            await dumpDir("after chrome cache root", chromeCacheRoot, 2);
            await dumpDir("after chrome install dir", chromeInstallDir);
        },
        60_000,
    );

    log(`chrome binary ${chromeBuildId} availability: ${chromeCanDownload}`);

    if (!chromeCanDownload) {
        throw new Error(`Chrome binary ${chromeBuildId} is not downloadable from ${chromeDownloadUrl}`);
    }

    const chromePath = await runLoggedStep(
        `chrome binary ${chromeBuildId} download/extract`,
        () =>
            registry.installBinary(PuppeteerBrowser.CHROME, platform, chromeBuildId, downloadProgressCallback =>
                installWithNativeUnzip({
                    browser: PuppeteerBrowser.CHROME,
                    platform,
                    buildId: chromeBuildId,
                    cacheDir: getBrowsersDir(),
                    installDir: chromeInstallDir,
                    executablePath: chromeExecutablePath,
                    label: `chrome binary ${chromeBuildId}`,
                    downloadProgressCallback,
                }),
            ),
        async () => {
            await dumpRegistry();
            await dumpPath("chrome archive", chromeArchivePath);
            await dumpPath("chrome executable", chromeExecutablePath);
            await dumpDir("after chrome cache root", chromeCacheRoot, 2);
            await dumpDir("after chrome install dir", chromeInstallDir);
        },
    );

    log(`chrome binary ${chromeBuildId}: installed path ${chromePath}`);

    log(`chromedriver binary ${chromeDriverBuildId}: download URL ${chromeDriverDownloadUrl}`);
    const chromeDriverCanDownload = await runLoggedStep(
        `chromedriver binary ${chromeDriverBuildId} availability`,
        () =>
            canDownload({
                browser: PuppeteerBrowser.CHROMEDRIVER,
                platform,
                buildId: chromeDriverBuildId,
                cacheDir: getChromeDriverDir(),
            }),
        async () => {
            await dumpPath("chromedriver archive", chromeDriverArchivePath);
            await dumpDir("after chromedriver cache root", chromeDriverCacheRoot, 2);
            await dumpDir("after chromedriver install dir", chromeDriverInstallDir);
        },
        60_000,
    );

    log(`chromedriver binary ${chromeDriverBuildId} availability: ${chromeDriverCanDownload}`);

    if (!chromeDriverCanDownload) {
        throw new Error(`Chromedriver binary ${chromeDriverBuildId} is not downloadable from ${chromeDriverDownloadUrl}`);
    }

    const chromeDriverPath = await runLoggedStep(
        `chromedriver binary ${chromeDriverBuildId} download/extract`,
        () =>
            registry.installBinary(
                PuppeteerBrowser.CHROMEDRIVER,
                platform,
                chromeDriverBuildId,
                downloadProgressCallback =>
                    installWithNativeUnzip({
                        browser: PuppeteerBrowser.CHROMEDRIVER,
                        platform,
                        buildId: chromeDriverBuildId,
                        cacheDir: getChromeDriverDir(),
                        installDir: chromeDriverInstallDir,
                        executablePath: chromeDriverExecutablePath,
                        label: `chromedriver binary ${chromeDriverBuildId}`,
                        downloadProgressCallback,
                    }),
            ),
        async () => {
            await dumpRegistry();
            await dumpPath("chromedriver archive", chromeDriverArchivePath);
            await dumpPath("chromedriver executable", chromeDriverExecutablePath);
            await dumpDir("after chromedriver cache root", chromeDriverCacheRoot, 2);
            await dumpDir("after chromedriver install dir", chromeDriverInstallDir);
        },
    );

    log(`chromedriver binary ${chromeDriverBuildId}: installed path ${chromeDriverPath}`);
    log(`finished installing ${browserTag}`);
}

(async (): Promise<void> => {
    try {
        await preloadStandaloneBrowser();
        log("preload completed");
    } catch (err) {
        console.error(`${LOG_PREFIX} preload failed`, err);
        process.exitCode = 1;
    }
})();
