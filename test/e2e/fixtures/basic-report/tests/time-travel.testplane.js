/* global window */

describe("time travel", () => {
    it("keeps steps aligned after delayed rrweb installation on navigation", async ({ browser }) => {
        await browser.url("time-travel.html");
        await browser.waitUntil(() => browser.execute(() => Boolean(window.rrweb)), {
            timeout: 3000,
            timeoutMsg: "rrweb recorder was not installed on the baseline page",
        });

        await browser.runStep("Open delayed page", async () => {
            await browser.url("time-travel-delayed.html");

            const rrwebInstallDelayMs = await browser.execute(() => window.rrwebInstallDelayMs);

            expect(rrwebInstallDelayMs).toBeGreaterThanOrEqual(1200);
        });

        await browser.runStep("Fill delayed input", async () => {
            await browser.$("#value").setValue("after-delay");
        });
    });
});
