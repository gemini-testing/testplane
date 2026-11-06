"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const sinon = require("sinon");
const Testplane = require("../build/src").default;
const { TestCollection } = require("../build/src/test-collection");
const { Test } = require("../build/src/test-reader/test-object");
const { BrowserRunner } = require("../build/src/runner/browser-runner");
const { ViteServer } = require("../build/src/runner/browser-env/vite/server");
const { TestPreflightError } = require("../build/src/errors/test-preflight-error");

async function main() {
    const [file, gridUrl, testRunEnv] = process.argv.slice(2);
    const test = Test.create({ title: "test", id: "test", file, location: undefined, fn() {} });
    test.browserId = "chrome";
    const collection = TestCollection.create({ chrome: [test] });
    const close = sinon.stub(ViteServer.prototype, "close").resolves();
    sinon.stub(ViteServer.prototype, "start").resolves();
    const config = {
        gridUrl,
        system: { workers: 1, testRunEnv },
        browsers: { chrome: { desiredCapabilities: { browserName: "chrome" } } },
        lastFailed: { output: path.join(process.cwd(), "failed.json") },
    };
    try {
        const testplane = await Testplane.create(config);
        const states = [];
        testplane.on(testplane.events.RUNNER_END, () => states.push(testplane.isFailed()));
        await assert.rejects(testplane.run(collection), TestPreflightError);
        assert.deepEqual(states, [true]);
        if (testRunEnv === "browser") assert.equal(close.callCount, 1);

        await fs.writeFile(file, 'it("fixed", async ({browser}) => { await browser.assertView("plane"); });\n');
        // Keep validation and lifecycle real; replace only terminal browser execution.
        const schedule = sinon.stub(BrowserRunner.prototype, "addTestToRun").returns(true);
        sinon.stub(BrowserRunner.prototype, "waitTestsCompletion").resolves();
        const fixed = await Testplane.create(config);
        assert.equal(await fixed.run(collection), true);
        assert.equal(schedule.callCount, 1);
        console.log("API_PREFLIGHT_PASSED");
    } finally {
        sinon.restore();
    }
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
