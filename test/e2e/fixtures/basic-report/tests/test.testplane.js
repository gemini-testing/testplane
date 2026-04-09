describe("test", () => {
    it("throws error and should have page screenshot", async ({ browser }) => {
        await browser.url("card-far-below-viewport.html");

        throw new Error("test error");
    });
});
