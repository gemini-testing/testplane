"use strict";

const BrowserAgent = require("src/runner/browser-agent");
const { BasicPool } = require("src/browser-pool/basic-pool");

describe("runner/browser-agent", () => {
    const sandbox = sinon.createSandbox();

    function mkAgent_({ id, version, pool } = {}) {
        id = id || "some-default-browser";
        version = version || "some.default.version";
        pool = pool || Object.create(BasicPool.prototype);

        return BrowserAgent.create({ id, version, pool });
    }

    function mkBrowser_(opts = {}) {
        return {
            id: "some-default-browser",
            sessionId: "some-default-session",
            state: {
                isBroken: false,
            },
            ...opts,
        };
    }

    beforeEach(() => {
        sandbox.stub(BasicPool.prototype, "getBrowser").resolves(mkBrowser_());
        sandbox.stub(BasicPool.prototype, "freeBrowser").resolves({});
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("should provide passed browser id", () => {
        const browserAgent = mkAgent_({ id: "bro" });

        assert.equal(browserAgent.browserId, "bro");
    });

    describe("getBrowser", () => {
        it("should request browser associated with agent", async () => {
            await mkAgent_({ id: "bro" }).getBrowser();

            assert.calledOnceWith(BasicPool.prototype.getBrowser, "bro");
        });

        it("should request browser with passed options", async () => {
            await mkAgent_({ version: "100.500" }).getBrowser({ foo: "bar" });

            assert.calledOnceWith(BasicPool.prototype.getBrowser, sinon.match.any, {
                foo: "bar",
                version: "100.500",
            });
        });

        it("should return browser returned by pool", async () => {
            const bro = mkBrowser_();
            BasicPool.prototype.getBrowser.resolves(bro);

            const browser = await mkAgent_().getBrowser();

            assert.equal(browser, bro);
        });

        it("should request other browser if got same session", async () => {
            const broFoo = mkBrowser_({ sessionId: "foo" });
            const broBar = mkBrowser_({ sessionId: "bar" });

            BasicPool.prototype.getBrowser.resolves(broFoo);

            const browserAgent = mkAgent_();

            await browserAgent.getBrowser();
            BasicPool.prototype.getBrowser.reset();

            BasicPool.prototype.getBrowser.onFirstCall().resolves(broFoo).onSecondCall().resolves(broBar);

            const bro2 = await browserAgent.getBrowser();

            assert.equal(bro2, broBar);
            assert.calledTwice(BasicPool.prototype.getBrowser);
            assert.calledOnceWith(BasicPool.prototype.freeBrowser, sinon.match.any, { force: true });
        });

        it("should always request browser with passed options", async () => {
            BasicPool.prototype.getBrowser
                .onCall(0)
                .resolves(mkBrowser_({ sessionId: "foo" }))
                .onCall(1)
                .resolves(mkBrowser_({ sessionId: "foo" }))
                .onCall(2)
                .resolves(mkBrowser_({ sessionId: "bar" }));

            const browserAgent = mkAgent_({ id: "bro", version: "100.500" });

            await browserAgent.getBrowser({ some: "opt" });
            await browserAgent.getBrowser({ some: "opt" });

            assert.alwaysCalledWith(BasicPool.prototype.getBrowser, "bro", { some: "opt", version: "100.500" });
        });
    });

    describe("freeBrowser", () => {
        it("should free passed browser", async () => {
            const bro = mkBrowser_();

            await mkAgent_().freeBrowser(bro);

            assert.calledOnceWith(BasicPool.prototype.freeBrowser, bro);
        });

        it("should not force free if browser is ok", async () => {
            const bro = mkBrowser_({ state: { isBroken: false } });

            await mkAgent_().freeBrowser(bro);

            assert.calledWith(BasicPool.prototype.freeBrowser, sinon.match.any, { force: false });
        });

        it("should force free broken browser", async () => {
            const bro = mkBrowser_({ state: { isBroken: true } });

            await mkAgent_().freeBrowser(bro);

            assert.calledWith(BasicPool.prototype.freeBrowser, sinon.match.any, { force: true });
        });

        it("should resolve with pool free result", async () => {
            const freeResult = { foo: "bar" };
            BasicPool.prototype.freeBrowser.resolves(freeResult);

            const result = await mkAgent_().freeBrowser(mkBrowser_());

            assert.equal(result, freeResult);
        });
    });
});
