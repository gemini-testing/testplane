"use strict";
const urljoin = require("url-join");
const PUPPETEER_REJECT_TIMEOUT = 5000;
module.exports.default = browser => {
    const { publicAPI: session, config } = browser;
    if (!session.getPuppeteer) {
        return;
    }
    session.overwriteCommand("getPuppeteer", async (origGetPuppeteer) => {
        return new Promise((resolve, reject) => {
            let isSettled = false;
            let rejectTimeout;
            origGetPuppeteer()
                .then(puppeteer => {
                if (!isSettled) {
                    resolve(puppeteer);
                }
            })
                .catch(error => {
                if (!isSettled) {
                    reject(error);
                }
            })
                .finally(() => {
                isSettled = true;
                clearTimeout(rejectTimeout);
            });
            rejectTimeout = setTimeout(() => {
                if (isSettled) {
                    return;
                }
                isSettled = true;
                browser.markAsBroken();
                reject(new Error(`Unable to establish a CDP connection in ${PUPPETEER_REJECT_TIMEOUT} ms`));
            }, PUPPETEER_REJECT_TIMEOUT);
        });
    });
    if (!config.browserWSEndpoint) {
        return;
    }
    // temporary hack to be able to change `browserWSEndpoint` for puppeteer (issue - https://github.com/webdriverio/webdriverio/issues/9323)
    session.overwriteCommand("getPuppeteer", async (origGetPuppeteer) => {
        const prevBrowserWSEndpoint = getCdpEndpoint(session.capabilities);
        const newBrowserWSEndpoint = urljoin(config.browserWSEndpoint, session.sessionId);
        setCdpEndpoint(session.capabilities, newBrowserWSEndpoint);
        try {
            return await origGetPuppeteer();
        }
        finally {
            setCdpEndpoint(session.capabilities, prevBrowserWSEndpoint);
        }
    });
};
function getCdpEndpoint(caps) {
    return caps.alwaysMatch ? caps.alwaysMatch["se:cdp"] : caps["se:cdp"];
}
function setCdpEndpoint(caps, value) {
    if (caps.alwaysMatch) {
        caps.alwaysMatch["se:cdp"] = value;
    }
    else {
        caps["se:cdp"] = value;
    }
}
//# sourceMappingURL=getPuppeteer.js.map