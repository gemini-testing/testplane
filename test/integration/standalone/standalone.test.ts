import { strict as assert } from "assert";
import { launchBrowser } from "../../../src/browser/standalone";
import { BrowserName } from "../../../src/browser/types";

describe("Standalone Browser E2E Tests", function () {
    this.timeout(10000);

    setTimeout(() => {
        console.error(
            "ERROR! Standalone test failed to complete in 30 seconds.\n" +
                "If all tests have passed, most likely this is caused by a bug in browser cleanup logic, e.g. deleteSession() command.",
        );
        process.exit(1);
    }, 30000).unref();

    let browser: WebdriverIO.Browser;

    const browserName = (process.env.BROWSER || "chrome").toLowerCase() as keyof typeof BrowserName;

    after(async function () {
        if (browser) {
            await browser.deleteSession();
        }
    });

    it("should launch browser and access a website", async function () {
        browser = await launchBrowser({
            desiredCapabilities: {
                browserName,
            },
            headless: true,
            system: {
                debug: Boolean(process.env.DEBUG) || false,
            },
        });

        assert.ok(browser, "Browser should be initialized");
        assert.ok(browser.sessionId, "Browser should have a valid session ID");

        await browser.url("https://example.com");

        const title = await browser.getTitle();
        assert.strictEqual(title, "Example Domain", "Page title should match");

        const h1Text = await browser.$("h1").getText();
        assert.strictEqual(h1Text, "Example Domain", "H1 text should match");
    });

    it("should execute JavaScript in the browser", async function () {
        assert.ok(browser, "Browser should be available from previous test");

        await browser.url("https://example.com");

        const result = await browser.execute(() => {
            // This code runs in the browser
            return document.querySelector("p")?.textContent;
        });

        assert.ok(
            result?.includes("This domain is for use in illustrative examples"),
            "Should execute JavaScript and return the expected result",
        );
    });

    it("should take screenshots", async function () {
        assert.ok(browser, "Browser should be available from previous test");

        await browser.url("https://example.com");

        const screenshotBuffer = await browser.takeScreenshot();
        assert.ok(screenshotBuffer, "Should be able to take a screenshot");
        assert.ok(screenshotBuffer.length > 1000, "Screenshot should have reasonable size");
    });
});
