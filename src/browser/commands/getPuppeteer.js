"use strict";

const urljoin = require("url-join");

const PUPPETEER_REJECT_TIMEOUT = 5000;

module.exports.default = browser => {
    const { publicAPI: session, config } = browser;

    if (!session.getPuppeteer) {
        return;
    }

    session.overwriteCommand("getPuppeteer", async origGetPuppeteer => {
        return new Promise((resolve, reject) => {
            let isSettled = false;
            let rejectTimeout;

            console.log('BEFORE GET ORIG GET PUPP');
            console.log('origGetPuppeteer:', origGetPuppeteer.toString());
            // console.log('this:', this);
            // console.log('this.default:', this.default);

            // this.puppeteer = 1;
            // this.puppeteer = 2;
            // console.log('this.puppeteer:', this.puppeteer);

            origGetPuppeteer()
                .then(puppeteer => {
                    console.log('PUPP, puppeteer:', puppeteer);

                    if (!isSettled) {
                        resolve(puppeteer);
                    }
                })
                .catch(error => {
                    console.log('PUPP, get error:', error);

                    if (!isSettled) {
                        reject(error);
                    }
                })
                .finally(() => {
                    console.log('PUPP, finnally');

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
    session.overwriteCommand("getPuppeteer", async origGetPuppeteer => {
        const prevBrowserWSEndpoint = getCdpEndpoint(session.capabilities);
        const newBrowserWSEndpoint = urljoin(config.browserWSEndpoint, session.sessionId);

        setCdpEndpoint(session.capabilities, newBrowserWSEndpoint);

        try {
            return await origGetPuppeteer();
        } finally {
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
    } else {
        caps["se:cdp"] = value;
    }
}
