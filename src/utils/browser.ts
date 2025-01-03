import { BrowserName, type W3CBrowserName } from "../browser/types";
import { MIN_CHROME_VERSION_SUPPORT_ISOLATION } from "../constants/browser";

export const isSupportIsolation = (browserName: string, browserVersion = ""): boolean => {
    const browserVersionMajor = browserVersion.split(".")[0];

    return browserName === "chrome" && Number(browserVersionMajor) >= MIN_CHROME_VERSION_SUPPORT_ISOLATION;
};

export const getNormalizedBrowserName = (browserName?: string): W3CBrowserName | null => {
    if (!browserName) {
        return null;
    }

    if (/chrome/i.test(browserName)) {
        return BrowserName.CHROME;
    }

    if (/firefox/i.test(browserName)) {
        return BrowserName.FIREFOX;
    }

    if (/edge/i.test(browserName)) {
        return BrowserName.EDGE;
    }

    if (/safari/i.test(browserName)) {
        return BrowserName.SAFARI;
    }

    return null;
};
