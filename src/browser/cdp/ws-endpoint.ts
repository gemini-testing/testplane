import { debugCdp } from "./debug";
import type { Browser } from "../types";

const endpointsCache = new WeakMap<Browser, string>();

export const getWsEndpoint = async (browser: Browser): Promise<string | null> => {
    const cachedEndpoint = endpointsCache.get(browser);

    if (cachedEndpoint) {
        return cachedEndpoint;
    }

    const session = browser.publicAPI;
    const caps = session.capabilities;
    const chromeOptions = caps["goog:chromeOptions"];

    // Priority 1: "browserWSEndpoint"
    if ("browserWSEndpoint" in browser.config && browser.config.browserWSEndpoint && session.sessionId) {
        const urljoin = await import("url-join").then(mod => mod.default);
        return urljoin(browser.config.browserWSEndpoint as string, session.sessionId);
    }

    // Priority 2: "se:cdp" capability
    if (caps["se:cdp"]) {
        return caps["se:cdp"];
    }

    // Priority 3: chrome debugger address
    if (chromeOptions && chromeOptions.debuggerAddress) {
        const versionUrl = `http://${chromeOptions.debuggerAddress}/json/version`;
        try {
            const cdpResponse = await fetch(versionUrl).then(res => res.json());
            if (cdpResponse && cdpResponse.webSocketDebuggerUrl) {
                return cdpResponse.webSocketDebuggerUrl;
            }
        } catch (err) {
            debugCdp(`Couldn't fetch chrome devtools debugger address at "${versionUrl}": ${err}`);
            return null;
        }
    }

    // Priority 4: selenium grid
    if (session.sessionId && session.options) {
        const hostname = session.options.hostname || "localhost";
        const port = session.options.port || 4444;
        const sessionId = session.sessionId;

        return `ws://${hostname}:${port}/session/${sessionId}/se/cdp`;
    }

    return null;
};
