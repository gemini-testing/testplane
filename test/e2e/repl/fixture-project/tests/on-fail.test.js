"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");

const pageUrl = pathToFileURL(path.join(__dirname, "..", "page.html")).href;

it("opens repl after failed test", async ({ browser }) => {
    await browser.url(pageUrl);
    await browser.$("#action").click();

    throw new Error("Intentional failure for REPL on fail e2e");
});
