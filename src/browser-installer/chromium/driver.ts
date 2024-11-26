import fs from "fs-extra";
import path from "path";
import { noop } from "lodash";
import { CHROMEDRIVER_STORAGE_API, MIN_CHROMIUM_VERSION } from "../constants";
import { installBinary } from "../registry";
import {
    downloadFile,
    getChromiumDriverDir,
    retryFetch,
    unzipFile,
    normalizeChromeVersion,
    Driver,
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
        throw new Error(
            [
                `chromedriver@${milestone} can't be installed.`,
                `Automatic driver downloader is not available for chrome versions < ${MIN_CHROMIUM_VERSION}`,
            ].join("\n"),
        );
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

    return installBinary(Driver.CHROMEDRIVER, platform, driverVersion, installFn);
};
