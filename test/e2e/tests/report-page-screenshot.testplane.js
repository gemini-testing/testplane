describe("report page screenshot on fail", () => {
    it("should show page screenshot for failed test", async ({ browser }) => {
        await browser.url("basic-report/new-ui.html");

        await browser.$("[data-qa=suites-tree-card]").waitForExist({ timeout: 15000 });
        const tree = await browser.$("[data-qa=tree-view-list]");
        const suiteNode = await tree.$("span=throws error and should have page screenshot");
        await suiteNode.waitForExist({ timeout: 15000 });

        let browserNode = await tree.$(".error-tree-node");
        if (!(await browserNode.isExisting())) {
            await suiteNode.click();
            browserNode = await tree.$(".error-tree-node");
        }
        await browserNode.waitForExist({ timeout: 15000 });
        await browserNode.click();

        const screenshot = await browser.$("img[alt='Screenshot']");
        await screenshot.waitForDisplayed({ timeout: 15000 });
        // Compare the captured page at the reference width, independently of the reporter panel layout.
        await browser.execute(image => {
            image.style.width = "725px";
            image.style.maxWidth = "none";
            image.style.height = "auto";
            image.style.boxSizing = "border-box";
        }, screenshot);
        await browser.assertView("basic-report-page-screenshot", "img[alt='Screenshot']", { tolerance: 10 });
    });
});
