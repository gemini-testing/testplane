const assert = require("node:assert/strict");
const { launchBrowser } = require("testplane/unstable");
const config = require("./testplane.config.cjs");

async function checkBrowser(browser) {
    await browser.url("data:text/html,<title>packed testplane</title>");
    assert.equal(await browser.getTitle(), "packed testplane");
    const puppeteer = await browser.getPuppeteer();
    assert.equal(puppeteer.isConnected(), true);
    const context = await puppeteer.createIncognitoBrowserContext();
    try {
        const page = await context.newPage();
        assert.equal(page.browser().isConnected(), true);
        assert.equal(page.target().browserContext().isIncognito(), true);
    } finally {
        await context.close();
    }
}

async function runStandalone() {
    const browser = await launchBrowser({ gridUrl: config.gridUrl, ...config.browsers.chrome });
    try {
        await checkBrowser(browser);
    } finally {
        await browser.deleteSession();
    }
}

module.exports = { checkBrowser };
if (require.main === module) {
    runStandalone().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
