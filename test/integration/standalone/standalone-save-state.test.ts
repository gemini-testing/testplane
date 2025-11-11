import { strict as assert } from "assert";
import { launchBrowser } from "../../../src/browser/standalone";
import { BROWSER_CONFIG, BROWSER_NAME } from "./constants";
import { SaveStateData } from "../../../src";
import { DEVTOOLS_PROTOCOL, WEBDRIVER_PROTOCOL } from "../../../src/constants/config";

import { AuthServer } from "./mock-auth-page/server";
import process from "node:process";

const TIMEOUT = 180000;

// fix for ff, he doesn't like localhost in domain
const removeDomainFromCookies = (loginState: SaveStateData): void => {
    if (loginState.cookies && loginState.cookies.length > 0) {
        for (const cookie of loginState.cookies) {
            delete cookie.domain;
        }
    }
};

type AutomationProtocol = typeof DEVTOOLS_PROTOCOL | typeof WEBDRIVER_PROTOCOL;

[DEVTOOLS_PROTOCOL, WEBDRIVER_PROTOCOL].forEach((automationProtocol): void => {
    if (automationProtocol === DEVTOOLS_PROTOCOL && BROWSER_NAME === "firefox") {
        return;
    }

    [true, false].forEach(webSocketUrl => {
        [true, false].forEach(isolation => {
            describe(`saveState and restoreState tests, isolation: ${isolation}, webSocketUrl: ${webSocketUrl}, automationProtocol: ${automationProtocol}`, function () {
                this.timeout(TIMEOUT);

                setTimeout(() => {
                    console.error(
                        `ERROR! Standalone test failed to complete in ${TIMEOUT / 1000} seconds.\n` +
                            "If all tests have passed, most likely this is caused by a bug in browser cleanup logic, e.g. deleteSession() command.",
                    );
                    process.exit(1);
                }, TIMEOUT).unref();

                let browser: WebdriverIO.Browser & { getDriverPid?: () => number | undefined };

                let loginState: SaveStateData;
                let status: WebdriverIO.Element;
                const mockAuthServer = new AuthServer();

                before(async () => {
                    console.log("Start mock server");
                    mockAuthServer.start();
                });

                beforeEach(async () => {
                    browser = await launchBrowser({
                        ...BROWSER_CONFIG,
                        desiredCapabilities: {
                            ...BROWSER_CONFIG.desiredCapabilities,
                            webSocketUrl,
                        },
                        isolation,
                        automationProtocol: automationProtocol as AutomationProtocol,
                    });

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

                    // save state
                    loginState = await browser.saveState();

                    if (automationProtocol === DEVTOOLS_PROTOCOL) {
                        await browser.pause(500);
                    }

                    // check that now we logged in
                    assert.strictEqual(await status.getText(), "You are logged in");
                });

                it("restoreState", async function () {
                    if (loginState) {
                        removeDomainFromCookies(loginState);

                        await browser.restoreState({
                            data: loginState,
                        });
                    }

                    // check that now we logged in
                    assert.strictEqual(await status.getText(), "You are logged in");
                });

                it("cookieFilter: restoreState", async function () {
                    // restore state
                    if (loginState) {
                        removeDomainFromCookies(loginState);

                        await browser.restoreState({
                            data: loginState,
                            cookieFilter: ({ name }) => name !== "sessionId",
                        });
                    }

                    // check that still we are not logged in
                    assert.strictEqual(await status.getText(), "You are not logged in");
                });

                it("cookieFilter: saveState", async function () {
                    const state = await browser.saveState({
                        cookieFilter: () => false,
                    });

                    // now we don't have cookie in save data object
                    assert.ok(state.cookies?.length === 0);
                });

                afterEach(async () => {
                    if (browser) {
                        await browser.deleteSession();
                    }
                });

                after(async () => {
                    console.log("Stop mock server");
                    mockAuthServer.stop();
                });
            });
        });
    });
});
