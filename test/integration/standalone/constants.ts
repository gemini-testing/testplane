import _ from "lodash";
import { BrowserName } from "../../../src/browser/types";

export const BROWSER_NAME = (process.env.BROWSER || "chrome").toLowerCase() as keyof typeof BrowserName;

export const BROWSER_CONFIG = {
    desiredCapabilities: {
        browserName: BROWSER_NAME,
    },
    headless: true,
    system: {
        debug: Boolean(process.env.DEBUG) || false,
    },
};

if (/chrome/i.test(BROWSER_NAME)) {
    _.set(BROWSER_CONFIG.desiredCapabilities, "goog:chromeOptions", {
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
}
