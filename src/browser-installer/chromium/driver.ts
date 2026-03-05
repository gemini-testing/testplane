import fs from "fs-extra";
import path from "path";
import { noop } from "lodash";
import { CHROMEDRIVER_STORAGE_API, MIN_CHROMIUM_VERSION } from "../constants";
import registry from "../registry";
import {
    downloadFile,
    getChromiumDriverDir,
    retryFetch,
    unzipFile,
    normalizeChromeVersion,
    DriverName,
    getBrowserPlatform,
} from "../utils";
import { getChromeDriverArchiveTmpPath, getChromeDriverArchiveUrl } from "./utils";

const getChromeDriverVersionByChromiumVersion = async (chromiumVersion: string | number): Promise<string> => {
    const suffix = typeof chromiumVersion === "number" ? chromiumVersion : normalizeChromeVersion(chromiumVersion);

    const result = await retryFetch(`${CHROMEDRIVER_STORAGE_API}/LATEST_RELEASE_${suffix}`).then(res => res.text());

    return result;
};

export const installChromeDriverManually = async (milestone: string): Promise<string> => {
    const platform = getBrowserPlatform();

    if (Number(milestone) < MIN_CHROMIUM_VERSION) {
        const lines: string[] = [];

        lines.push(`Failed to install ChromeDriver for Chrome@${milestone}: version is too old.`);
        lines.push(
            `\nTestplane's automatic ChromeDriver downloader only supports Chrome versions >= ${MIN_CHROMIUM_VERSION}.`,
            `The requested version '${milestone}' is below this threshold.`,
        );

        lines.push(
            "\nWhat you can do:",
            `- Use Chrome/Chromium version ${MIN_CHROMIUM_VERSION} or higher`,
            "- If you must test with this old version, download ChromeDriver manually from https://chromedriver.chromium.org/downloads and set 'webdriverBinaryPath' in your config",
        );

        throw new Error(lines.join("\n"));
    }

    const driverVersion = await getChromeDriverVersionByChromiumVersion(milestone);

    const installFn = async (): Promise<string> => {
        const archiveUrl = getChromeDriverArchiveUrl(driverVersion);
        const archivePath = getChromeDriverArchiveTmpPath(driverVersion);
        const chromeDriverDirPath = getChromiumDriverDir(driverVersion);
        const chromeDriverPath = path.join(chromeDriverDirPath, "chromedriver");

        await downloadFile(archiveUrl, archivePath);
        await unzipFile(archivePath, chromeDriverDirPath);

        fs.remove(archivePath).then(noop, noop);

        return chromeDriverPath;
    };

    return registry.installBinary(DriverName.CHROMEDRIVER, platform, driverVersion, installFn);
};
