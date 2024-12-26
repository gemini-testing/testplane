import { BrowserName, type W3CBrowserName } from "../browser/types";

export const resolveBrowserVersion = (browserName: W3CBrowserName, { force = false } = {}): Promise<string> => {
    switch (browserName) {
        case BrowserName.CHROME:
            return import("./chrome").then(module => module.resolveLatestChromeVersion(force));
        case BrowserName.FIREFOX:
            return import("./firefox").then(module => module.resolveLatestFirefoxVersion(force));
        case BrowserName.EDGE:
            return import("./edge").then(module => module.resolveEdgeVersion());
        case BrowserName.SAFARI:
            return import("./safari").then(module => module.resolveSafariVersion());
    }
};
