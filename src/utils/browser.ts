import { MIN_CHROME_VERSION_SUPPORT_ISOLATION } from "../constants/browser.js";

export const isSupportIsolation = (browserName: string, browserVersion = ""): boolean => {
    const browserVersionMajor = browserVersion.split(".")[0];

    return browserName === "chrome" && Number(browserVersionMajor) >= MIN_CHROME_VERSION_SUPPORT_ISOLATION;
};
