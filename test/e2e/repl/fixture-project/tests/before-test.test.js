"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Used by REPL e2e assertions through generated context.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const rootValue = 1000;
const pageUrl = pathToFileURL(path.join(__dirname, "..", "page.html")).href;

// `localValue` is used by REPL e2e assertions through generated context.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
it("opens repl before test body", async ({ browser, localValue = 234 }) => {
    await browser.url(pageUrl);

    assert.equal(await browser.$("#title").getText(), "REPL fixture page");
});
