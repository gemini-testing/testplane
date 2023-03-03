'use strict';

const urljoin = require('url-join');

module.exports = (browser) => {
    const {publicAPI: session, config} = browser;

    if (!config.browserWSEndpoint || !session.getPuppeteer) {
        return;
    }

    // temporary hack to be able to change `browserWSEndpoint` for puppeteer (issue - https://github.com/webdriverio/webdriverio/issues/9323)
    session.overwriteCommand('getPuppeteer', async (origGetPuppeteer) => {
        const prevBrowserWSEndpoint = getCdpEndpoint(session.capabilities);
        const newBrowserWSEndpoint = urljoin(config.browserWSEndpoint, session.sessionId);

        setCdpEndpoint(session.capabilities, newBrowserWSEndpoint);

        try {
            return origGetPuppeteer();
        } finally {
            setCdpEndpoint(session.capabilities, prevBrowserWSEndpoint);
        }
    });
};

function getCdpEndpoint(caps) {
    return caps.alwaysMatch
        ? caps.alwaysMatch['se:cdp']
        : caps['se:cdp'];
}

function setCdpEndpoint(caps, value) {
    if (caps.alwaysMatch) {
        caps.alwaysMatch['se:cdp'] = value;
    } else {
        caps['se:cdp'] = value;
    }
}
