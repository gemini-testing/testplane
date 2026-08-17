/* global window */

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
});
