import type { ChildProcess } from "child_process";
import { installBrowser } from "./install";
import { Browser, type SupportedBrowser } from "./utils";

export const runBrowserDriver = async (
    browserName: SupportedBrowser,
    browserVersion: string,
    { debug = false } = {},
): Promise<{ gridUrl: string; process: ChildProcess; port: number }> => {
    const installBrowserOpts = { shouldInstallWebDriver: true, shouldInstallUbuntuPackages: true };

    await installBrowser(browserName, browserVersion, installBrowserOpts);

    switch (browserName) {
        case Browser.CHROME:
        case Browser.CHROMIUM:
            return import("./chrome").then(module => module.runChromeDriver(browserVersion, { debug }));
        case Browser.FIREFOX:
            return import("./firefox").then(module => module.runGeckoDriver(browserVersion, { debug }));
        case Browser.EDGE:
            return import("./edge").then(module => module.runEdgeDriver(browserVersion, { debug }));
        case Browser.SAFARI:
            return import("./safari").then(module => module.runSafariDriver({ debug }));
        default:
            throw new Error(`Invalid browser: ${browserName}. Expected one of: ${Object.values(Browser).join(", ")}`);
    }
};
