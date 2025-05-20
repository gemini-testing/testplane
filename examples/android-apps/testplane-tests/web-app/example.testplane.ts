describe("web, chrome app", () => {
    it("should lead to the project repository when click on github link", async ({browser}) => {
        await browser.url("https://testplane.io");

        await browser.$('*=Star on github').click();
        await browser.switchWindow('https://github.com/gemini-testing/testplane');

        await expect(browser).toHaveTitle('GitHub - gemini-testing/testplane: Testplane (ex-hermione) browser test runner based on mocha and wdio');
    });
});
