import { BrowserName, type W3CBrowserName } from "../browser/types";
import type { BrowserDownloadMirrors } from "../config/types";

export const resolveBrowserVersion = (
    browserName: W3CBrowserName,
    {
        force = false,
        browserDownloadMirrors,
    }: { force?: boolean; browserDownloadMirrors?: BrowserDownloadMirrors } = {},
): Promise<string> => {
    switch (browserName) {
        case BrowserName.CHROME:
        case BrowserName.CHROMEHEADLESSSHELL:
            return import("./chrome").then(module => module.resolveLatestChromeVersion(force, browserDownloadMirrors));
        case BrowserName.FIREFOX:
            return import("./firefox").then(module =>
                module.resolveLatestFirefoxVersion(force, browserDownloadMirrors),
            );
        case BrowserName.EDGE:
            return import("./edge").then(module => module.resolveEdgeVersion());
        case BrowserName.SAFARI:
            return import("./safari").then(module => module.resolveSafariVersion());
    }
};
