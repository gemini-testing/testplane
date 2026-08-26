import { URL } from "node:url";

import type { BrowserDownloadMirrors } from "../config/types";
import { BrowserName } from "../browser/types";
import type { SupportedBrowser } from "./utils";

const CONFIGURED_MIRROR_DOWNLOAD_ERROR = "Couldn't download browser artifact from the configured mirror";

export const normalizeBrowserDownloadMirror = (mirror: unknown, optionName: string): string => {
    if (typeof mirror !== "string") {
        throw new Error(`"${optionName}" must be a string`);
    }

    const trimmedMirror = mirror.trim();

    if (!trimmedMirror) {
        throw new Error(`"${optionName}" must not be empty`);
    }

    let url: URL;

    try {
        url = new URL(trimmedMirror);
    } catch {
        throw new Error(`"${optionName}" must be an absolute http: or https: URL`);
    }

    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) {
        throw new Error(`"${optionName}" must be an absolute http: or https: URL`);
    }

    if (url.username || url.password) {
        throw new Error(`"${optionName}" must not contain a username or password`);
    }

    if (trimmedMirror.includes("?")) {
        throw new Error(`"${optionName}" must not contain a query string`);
    }

    if (trimmedMirror.includes("#")) {
        throw new Error(`"${optionName}" must not contain a fragment`);
    }

    return url.toString().replace(/\/+$/, "");
};

export const getBrowserDownloadMirror = (
    browserName: SupportedBrowser,
    mirrors?: BrowserDownloadMirrors,
): string | undefined => {
    let mirrorName: keyof BrowserDownloadMirrors;

    switch (browserName) {
        case BrowserName.CHROME:
        case BrowserName.CHROMEHEADLESSSHELL:
            mirrorName = "chrome";
            break;
        case BrowserName.CHROMIUM:
            mirrorName = "chromium";
            break;
        case BrowserName.FIREFOX:
            mirrorName = "firefox";
            break;
        default:
            return undefined;
    }

    const mirror = mirrors?.[mirrorName];

    if (mirror === null || mirror === undefined) {
        return undefined;
    }

    return normalizeBrowserDownloadMirror(mirror, `browserDownloadMirrors.${mirrorName}`);
};

export const getBrowserDownloadMirrorFileUrl = (mirror: string, filename: string): string =>
    new URL(filename, `${mirror.replace(/\/+$/, "")}/`).toString();

export const sanitizeBrowserDownloadMirrorError = (error: unknown, mirror?: string): unknown =>
    mirror ? new Error(CONFIGURED_MIRROR_DOWNLOAD_ERROR) : error;
