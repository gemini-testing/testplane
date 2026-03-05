import type { ChildProcess } from "child_process";
import { installBrowser } from "./install";
import type { SupportedBrowser } from "./utils";
import { BrowserName } from "../browser/types";

export const runBrowserDriver = async (
    browserName: SupportedBrowser,
    browserVersion: string,
    { debug = false } = {},
): Promise<{ gridUrl: string; process: ChildProcess; port: number }> => {
    const installBrowserOpts = { shouldInstallWebDriver: true, shouldInstallUbuntuPackages: true };

    await installBrowser(browserName, browserVersion, installBrowserOpts);

    switch (browserName) {
        case BrowserName.CHROME:
        case BrowserName.CHROMIUM:
        case BrowserName.CHROMEHEADLESSSHELL:
            return import("./chrome").then(module => module.runChromeDriver(browserVersion, { debug }));
        case BrowserName.FIREFOX:
            return import("./firefox").then(module => module.runGeckoDriver(browserVersion, { debug }));
        case BrowserName.EDGE:
            return import("./edge").then(module => module.runEdgeDriver(browserVersion, { debug }));
        case BrowserName.SAFARI:
            return import("./safari").then(module => module.runSafariDriver({ debug }));
        default: {
            const validBrowsers = Object.values(BrowserName).join(", ");
            const lines: string[] = [];

            lines.push(`Cannot start browser driver: unknown browser name "${browserName}".`);
            lines.push(
                `\nTestplane does not know how to launch a WebDriver for "${browserName}".`,
                `Valid browser names are: ${validBrowsers}`,
            );

            lines.push(
                "\nWhat you can do:",
                `- Check the 'desiredCapabilities.browserName' in your Testplane config`,
                `- Make sure you are using one of the supported values: ${validBrowsers}`,
            );

            throw new Error(lines.join("\n"));
        }
    }
};
