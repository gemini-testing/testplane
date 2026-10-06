import { download as downloadGeckoDriver } from "geckodriver";
import fs from "fs-extra";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { BrowserPlatform } from "@puppeteer/browsers";
import { GECKODRIVER_CARGO_TOML } from "../constants";
import registry from "../registry";
import {
    DriverName,
    browserInstallerDebug,
    getBrowserPlatform,
    getGeckoDriverDir,
    retryFetch,
    unzipFile,
} from "../utils";
import type { BrowserDownloadMirrors } from "../../config/types";
import { getBrowserDownloadMirror, getBrowserDownloadMirrorFileUrl } from "../mirrors";

const execFileAsync = promisify(execFile);
const GECKODRIVER_PLATFORMS = {
    [BrowserPlatform.LINUX]: "linux64",
    [BrowserPlatform.LINUX_ARM]: "linux-aarch64",
    [BrowserPlatform.MAC]: "macos",
    [BrowserPlatform.MAC_ARM]: "macos-aarch64",
    [BrowserPlatform.WIN32]: "win32",
    [BrowserPlatform.WIN64]: "win64",
};

const getLatestGeckoDriverVersion = async (mirror?: string): Promise<string> => {
    const url = mirror ? getBrowserDownloadMirrorFileUrl(mirror, "Cargo.toml") : GECKODRIVER_CARGO_TOML;
    const response = await retryFetch(url);

    if (!response.ok) {
        throw new Error(`Couldn't resolve latest geckodriver version from ${url}: ${response.status}`);
    }

    const cargoVersionsToml = await response.text();
    const versionLine = cargoVersionsToml.split("\n").find(line => /^version\s*=/.test(line));
    const version = versionLine?.match(/^version\s*=\s*["'](\d+\.\d+\.\d+)["']/);

    if (!version) {
        throw new Error("Couldn't resolve latest geckodriver version while downloading geckodriver");
    }

    const latestGeckoVersion = version[1];

    browserInstallerDebug(`resolved latest geckodriver version: ${latestGeckoVersion}`);

    return latestGeckoVersion;
};

const downloadMirroredGeckoDriver = async (
    version: string,
    platform: BrowserPlatform,
    mirror: string,
): Promise<string> => {
    const isWindows = platform === BrowserPlatform.WIN32 || platform === BrowserPlatform.WIN64;
    const filename = `geckodriver-v${version}-${GECKODRIVER_PLATFORMS[platform]}${isWindows ? ".zip" : ".tar.gz"}`;
    const url = getBrowserDownloadMirrorFileUrl(mirror, `v${version}/${filename}`);

    browserInstallerDebug(`downloading ${DriverName.GECKODRIVER}@${version} from mirror ${mirror}`);

    const response = await retryFetch(url);

    if (!response.ok || !response.body) {
        throw new Error(`Unable to download geckodriver from ${url}: ${response.status}`);
    }

    const driverDir = getGeckoDriverDir(version);
    await fs.ensureDir(driverDir);
    const downloadDir = await fs.mkdtemp(path.join(driverDir, "download-"));

    try {
        const archivePath = path.join(downloadDir, filename);
        await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(archivePath));

        if (isWindows) {
            await unzipFile(archivePath, driverDir);
        } else {
            await execFileAsync("tar", ["-xzf", archivePath, "-C", driverDir]);
        }

        const binaryPath = path.join(driverDir, isWindows ? "geckodriver.exe" : "geckodriver");
        await fs.chmod(binaryPath, 0o755);

        return binaryPath;
    } finally {
        await fs.remove(downloadDir);
    }
};

export const installLatestGeckoDriver = async (
    firefoxVersion: string,
    {
        force = false,
        browserDownloadMirrors,
    }: { force?: boolean; browserDownloadMirrors?: BrowserDownloadMirrors } = {},
): Promise<string> => {
    const platform = getBrowserPlatform();
    const existingLocallyDriverVersion = registry.getMatchedDriverVersion(
        DriverName.GECKODRIVER,
        platform,
        firefoxVersion,
    );

    if (existingLocallyDriverVersion && !force) {
        browserInstallerDebug(
            `A locally installed geckodriver for firefox@${firefoxVersion} browser was found. Skipping the installation`,
        );

        return registry.getBinaryPath(DriverName.GECKODRIVER, platform, existingLocallyDriverVersion);
    }

    const mirror = getBrowserDownloadMirror(DriverName.GECKODRIVER, browserDownloadMirrors);
    const latestVersion = await getLatestGeckoDriverVersion(mirror);

    const installFn = (): Promise<string> =>
        mirror
            ? downloadMirroredGeckoDriver(latestVersion, platform, mirror)
            : downloadGeckoDriver(latestVersion, getGeckoDriverDir(latestVersion));

    return registry.installBinary(DriverName.GECKODRIVER, platform, latestVersion, installFn);
};
