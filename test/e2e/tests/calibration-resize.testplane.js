describe("calibration", () => {
    it("should work correctly when window size changes", async ({ browser }) => {
        await browser.url("viewport-sized-block.html");

        await browser.assertView("before", '[data-testid="viewport-block"]', { compositeImage: false });

        await browser.setWindowSize(900, 900);

        await browser.assertView("after", '[data-testid="viewport-block"]', { compositeImage: false });
    });
});
