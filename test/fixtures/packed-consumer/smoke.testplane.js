const { checkBrowser } = require("./standalone.cjs");

it("runs with the installed Testplane package", async ({ browser }) => {
    await checkBrowser(browser);
});
