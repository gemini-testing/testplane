import { strict as assert } from "assert";
import { launchBrowser, attachToBrowser } from "../../../src/browser/standalone";
import { BROWSER_CONFIG } from "./constants";

const checkProcessExists = (pid: number): boolean => {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

describe("Standalone Browser E2E Tests", function () {
    this.timeout(25000);

    setTimeout(() => {
        console.error(
            "ERROR! Standalone test failed to complete in 30 seconds.\n" +
                "If all tests have passed, most likely this is caused by a bug in browser cleanup logic, e.g. deleteSession() command.",
        );
        process.exit(1);
    }, 60000).unref();

    let browser: WebdriverIO.Browser & { getPid?: () => number | undefined };

    after(async function () {
        await browser.deleteSession();
    });

    it("should launch browser and access a website", async function () {
        browser = await launchBrowser(BROWSER_CONFIG);

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

    it("attach to browser works", async function () {
        browser = await launchBrowser(BROWSER_CONFIG);
        await browser.url("https://example.com");
        const pid = (await browser.getPid!()) as number;

        const attachedBrowser = await attachToBrowser({
            sessionId: browser.sessionId,
            sessionCaps: browser.capabilities,
            sessionOpts: {
                capabilities: browser.capabilities,
                ...browser.options,
            },
            pid,
        });

        await attachedBrowser.url("https://yandex.com/");

        const url = await browser.getUrl();

        // Check that change url in attached browser change url in original browser
        assert.strictEqual(url, "https://yandex.com/");

        // Check that browser process exist
        assert.strictEqual(checkProcessExists(pid), true);

        // Delete session should kill process
        await attachedBrowser.deleteSession();

        // Check that browser process doesn't exist
        setTimeout(() => assert.strictEqual(checkProcessExists(pid), false), 100);
    });
});
