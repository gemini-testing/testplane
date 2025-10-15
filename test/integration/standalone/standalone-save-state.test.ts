import { strict as assert } from "assert";
import { launchBrowser } from "../../../src/browser/standalone";
import { BROWSER_CONFIG } from "./constants";
import { SaveStateData } from "../../../src";

import { AuthServer } from "./mock-auth-page/server";
import process from "node:process";

describe("saveState and restoreState tests", function () {
    this.timeout(25000);

    setTimeout(() => {
        console.error(
            "ERROR! Standalone test failed to complete in 120 seconds.\n" +
                "If all tests have passed, most likely this is caused by a bug in browser cleanup logic, e.g. deleteSession() command.",
        );
        process.exit(1);
    }, 120000).unref();

    let browser: WebdriverIO.Browser & { getDriverPid?: () => number | undefined };

    let loginState: SaveStateData;
    let status: WebdriverIO.Element;
    const mockAuthServer = new AuthServer();

    before(async () => {
        console.log("Start mock server");
        mockAuthServer.start();
    });

    beforeEach(async () => {
        browser = await launchBrowser(BROWSER_CONFIG);

        assert.ok(browser, "Browser should be initialized");
        assert.ok(browser.sessionId, "Browser should have a valid session ID");

        // go to mock page
        await browser.url("http://localhost:3000/");

        status = await browser.$("#status");

        // check that we are not logged in
        assert.strictEqual(await status.getText(), "You are not logged in");
    });

    it("saveState", async function () {
        // input login
        const emailInput = await browser.$("#login");
        await emailInput.setValue("admin");

        // input password
        const passwordInput = await browser.$("#password");
        await passwordInput.setValue("admin123");

        // click to login
        const logInButton = await browser.$('[type="submit"]');
        await logInButton.click();

        // check that now we logged in
        assert.strictEqual(await status.getText(), "You are logged in");

        // save state
        loginState = await browser.saveState();
    });

    it("restoreState", async function () {
        if (loginState) {
            // fix for ff, he doesn't like localhost in domain
            if (loginState.cookies && loginState.cookies.length > 0) {
                delete loginState.cookies[0].domain;
            }

            await browser.restoreState({
                data: loginState,
            });
        }

        // check that now we logged in
        assert.strictEqual(await status.getText(), "You are logged in");
    });

    afterEach(async () => {
        await browser.deleteSession();
    });

    after(async () => {
        console.log("Stop mock server");
        mockAuthServer.stop();
    });
});
