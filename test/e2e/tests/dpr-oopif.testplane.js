/* global document, window */

describe("assertView with DPR and OOPIFs", () => {
    it("should capture the whole bordered element after nested cross-site iframes attach", async ({ browser }) => {
        await browser.url("http://localhost:3000/dpr-oopif.html");

        expect(await browser.execute(() => window.devicePixelRatio)).toBe(3);

        await browser.$("#attach").click();
        await browser.pause(3000);

        // Here, we expect DPR to be 1 to verify that the bug with pixel ratio actually reproduced, but assertView
        // should still work correctly. Without this check, it's easy to have evergreen test.
        expect(await browser.execute(() => window.devicePixelRatio)).toBe(1);

        await browser.assertView("bordered-block", "[data-testid=capture-target]");
    });

    it("should capture the whole bordered element when DPR changes after taking the screenshot", async ({
        browser,
    }) => {
        await browser.url("http://localhost:3000/dpr-oopif.html");

        expect(await browser.execute(() => window.devicePixelRatio)).toBe(3);

        const originalTakeScreenshot = browser.takeScreenshot.bind(browser);
        let shouldAttachIframes = true;

        browser.overwriteCommand("takeScreenshot", async () => {
            const screenshot = await originalTakeScreenshot();

            if (shouldAttachIframes) {
                shouldAttachIframes = false;
                // Reproduce the race between taking the screenshot and validating its pixel ratio.
                await browser.execute(() => document.querySelector("#attach").click());
                await browser.waitUntil(async () => (await browser.execute(() => window.devicePixelRatio)) === 1, {
                    timeout: 10000,
                    interval: 50,
                    timeoutMsg: "Nested cross-site iframes did not change devicePixelRatio to 1",
                });
            }

            return screenshot;
        });

        try {
            await browser.assertView("bordered-block", "[data-testid=capture-target]");
        } finally {
            browser.overwriteCommand("takeScreenshot", async () => originalTakeScreenshot());
        }
    });
});
