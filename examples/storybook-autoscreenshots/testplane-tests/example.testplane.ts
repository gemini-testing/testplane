
describe("test", () => {
    it("example", async ({browser}) => {
        await browser.url("https://github.com/gemini-testing/testplane");

        await expect(browser.$(".f4.my-3")).toHaveText("Testplane (ex-hermione) browser test runner based on mocha and wdio");
    });
});
