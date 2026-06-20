import { BrowserInstallStatus, installBrowsersWithDrivers } from "../src/browser-installer";
import { BROWSER_NAME, BROWSER_VERSION } from "../test/integration/standalone/constants";

(async (): Promise<void> => {
    const browser = { browserName: BROWSER_NAME, browserVersion: BROWSER_VERSION };
    const browserLabel = `${browser.browserName}@${browser.browserVersion}`;
    const installResults = await installBrowsersWithDrivers([browser]);
    const result = installResults[browserLabel];

    if (result?.status !== BrowserInstallStatus.Ok) {
        throw new Error(`Failed to preload standalone browser ${browserLabel}`);
    }
})().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
