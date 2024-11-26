import os from "os";
import path from "path";
import { BrowserPlatform } from "@puppeteer/browsers";
import { getChromePlatform, getMilestone } from "../utils";
import { CHROMEDRIVER_STORAGE_API, MIN_CHROMEDRIVER_MAC_ARM_NEW_ARCHIVE_NAME } from "../constants";

export const getChromiumBuildId = async (platform: BrowserPlatform, milestone: string | number): Promise<string> => {
    const { default: revisions } = await import(`./revisions/${platform}`);

    return String(revisions[milestone]);
};

export const getChromeDriverArchiveUrl = (version: string): string => {
    const chromeDriverArchiveName: Record<BrowserPlatform, string> = {
        linux: "linux64",
        mac: "mac64",
        mac_arm: "mac64_m1", // eslint-disable-line camelcase
        win32: "win32",
        win64: "win32",
    };

    const milestone = getMilestone(version);
    const platform = getChromePlatform(version);
    const isNewMacArm =
        platform === BrowserPlatform.MAC_ARM && Number(milestone) >= MIN_CHROMEDRIVER_MAC_ARM_NEW_ARCHIVE_NAME;
    const archiveName = isNewMacArm ? "mac_arm64" : chromeDriverArchiveName[platform];
    const archiveUrl = `${CHROMEDRIVER_STORAGE_API}/${version}/chromedriver_${archiveName}.zip`;

    return archiveUrl;
};

export const getChromeDriverArchiveTmpPath = (version: string): string => {
    const randomString = Math.floor(Math.random() * Date.now()).toString(36);

    return path.join(os.tmpdir(), `chromedriver-${version}-${randomString}.zip`);
};
