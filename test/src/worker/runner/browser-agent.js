"use strict";

const BrowserAgent = require("src/worker/runner/browser-agent");
const BrowserPool = require("src/worker/runner/browser-pool");

describe("worker/browser-agent", () => {
    let browserPool;

    beforeEach(() => (browserPool = sinon.createStubInstance(BrowserPool)));

    describe("getBrowser", () => {
        it("should get a browser from the pool", () => {
            browserPool.getBrowser
                .withArgs({
                    browserId: "bro-id",
                    browserVersion: null,
                    sessionId: "100-500",
                    sessionCaps: "some-caps",
                    sessionOpts: "some-opts",
                    testXReqId: "12345",
                })
                .returns({ some: "browser" });
            const browserAgent = BrowserAgent.create({ id: "bro-id", version: null, pool: browserPool });

            const browser = browserAgent.getBrowser({
                sessionId: "100-500",
                sessionCaps: "some-caps",
                sessionOpts: "some-opts",
                testXReqId: "12345",
            });

            assert.deepEqual(browser, { some: "browser" });
        });

        it("should get a browser with specific version from the pool", () => {
            browserPool.getBrowser
                .withArgs({
                    browserId: "bro-id",
                    browserVersion: "10.1",
                    sessionId: "100-500",
                    sessionCaps: "some-caps",
                    sessionOpts: "some-opts",
                    testXReqId: "12345",
                })
                .returns({ some: "browser" });
            const browserAgent = BrowserAgent.create({ id: "bro-id", version: "10.1", pool: browserPool });

            const browser = browserAgent.getBrowser({
                sessionId: "100-500",
                sessionCaps: "some-caps",
                sessionOpts: "some-opts",
                testXReqId: "12345",
            });

            assert.deepEqual(browser, { some: "browser" });
        });
    });

    describe("freeBrowser", () => {
        it("should free the browser in the pool", () => {
            BrowserAgent.create({ pool: browserPool }).freeBrowser({ some: "browser" });

            assert.calledOnceWith(browserPool.freeBrowser, { some: "browser" });
        });
    });
});
