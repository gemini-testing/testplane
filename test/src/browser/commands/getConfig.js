"use strict";

const webdriverio = require("webdriverio");
const clientBridge = require("src/browser/client-bridge");
const { mkExistingBrowser_: mkBrowser_, mkSessionStub_ } = require("../utils");

describe('"getConfig" command', () => {
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
        sandbox.stub(webdriverio, "attach");
        sandbox.stub(clientBridge, "build").resolves();
    });

    afterEach(() => sandbox.restore());

    const initBrowser_ = ({ browser = mkBrowser_(), session = mkSessionStub_() } = {}) => {
        webdriverio.attach.resolves(session);

        return browser.init({ sessionId: session.sessionId, sessionCaps: session.capabilities });
    };

    it("should return object", async () => {
        const session = mkSessionStub_();

        await initBrowser_({ session });

        assert.isFunction(session.getConfig);
        const browserConfig = session.getConfig();
        assert.isObject(browserConfig);
    });

    it("should have defined baseUrl", async () => {
        const session = mkSessionStub_();
        const browser = mkBrowser_({ baseUrl: "http://custom_base_url" });

        await initBrowser_({ browser, session });

        const browserConfig = session.getConfig();
        assert.equal(browserConfig.baseUrl, "http://custom_base_url");
    });
});
