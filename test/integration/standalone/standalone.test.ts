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
            "ERROR! Standalone test failed to complete in 120 seconds.\n" +
                "If all tests have passed, most likely this is caused by a bug in browser cleanup logic, e.g. deleteSession() command.",
        );
        process.exit(1);
    }, 120000).unref();

    let browser: WebdriverIO.Browser & { getDriverPid?: () => number | undefined };

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
            result?.includes("This domain is for use in documentation examples without needing permission."),
            "Should execute JavaScript and return the expected result",
        );
    });

    it("should take screenshots", async function () {
        assert.ok(browser, "Browser should be available from previous test");

        await browser.url("https://example.com");

        const screenshotBuffer = await browser.takeScreenshot();
        assert.ok(screenshotBuffer, "Should be able to take a screenshot");
        assert.ok(screenshotBuffer.length > 1000, "Screenshot should have reasonable size");

        await browser.deleteSession();
    });

    it("attach to browser works", async function () {
        browser = await launchBrowser(BROWSER_CONFIG);
        await browser.url("https://example.com");
        const driverPid = (await browser.getDriverPid!()) as number;

        const attachedBrowser = await attachToBrowser({
            sessionId: browser.sessionId,
            sessionCaps: browser.capabilities,
            sessionOpts: {
                capabilities: browser.capabilities,
                ...browser.options,
            },
            driverPid,
        });

        await attachedBrowser.url("https://yandex.com/");

        const url = await browser.getUrl();

        // Check that change url in attached browser change url in original browser
        assert.strictEqual(url, "https://yandex.com/");

        // Check that browser process exist
        assert.strictEqual(checkProcessExists(driverPid), true);

        // Delete session should kill process
        await attachedBrowser.deleteSession();

        await browser.pause(100);

        // Check that browser process doesn't exist
        assert.strictEqual(checkProcessExists(driverPid), false);
    });
});
