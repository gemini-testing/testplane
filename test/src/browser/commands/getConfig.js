"use strict";

const { mkExistingBrowser_: mkBrowser_, mkSessionStub_ } = require("../utils");
const proxyquire = require("proxyquire");

describe('"getConfig" command', () => {
    const sandbox = sinon.createSandbox();
    let ExistingBrowser;
    let webdriverioAttachStub;
    let clientBridgeBuildStub;

    beforeEach(() => {
        webdriverioAttachStub = sandbox.stub();
        clientBridgeBuildStub = sandbox.stub().resolves();

        ExistingBrowser = proxyquire("src/browser/existing-browser", {
            "@testplane/webdriverio": {
                attach: webdriverioAttachStub,
            },
            "./client-bridge": {
                build: clientBridgeBuildStub,
            },
        }).ExistingBrowser;
    });

    afterEach(() => sandbox.restore());

    const initBrowser_ = ({
        browser = mkBrowser_(undefined, undefined, ExistingBrowser),
        session = mkSessionStub_(),
    } = {}) => {
        webdriverioAttachStub.resolves(session);

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
        const browser = mkBrowser_({ baseUrl: "http://custom_base_url" }, undefined, ExistingBrowser);

        await initBrowser_({ browser, session });

        const browserConfig = session.getConfig();
        assert.equal(browserConfig.baseUrl, "http://custom_base_url");
    });
});
