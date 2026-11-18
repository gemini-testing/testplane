"use strict";

const assert = require("node:assert/strict");

it("sends a request", async ({ browser }) => {
    await browser.url("/");
    const body = await browser.execute(async () => {
        const response = await fetch("/redirect", { method: "POST", body: "fixture payload" });
        return response.text();
    });

    assert.equal(body, "received fixture payload");
});
