"use strict";

const _ = require("lodash");
const { mkExistingBrowser_: mkBrowser_, mkSessionStub_ } = require("../utils");
const proxyquire = require("proxyquire");

describe('"getPuppeteer" command', () => {
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

    it('should not overwrite command if command "getPuppeteer" does not exist in browser', async () => {
        const session = mkSessionStub_();
        session.getPuppeteer = undefined;

        await initBrowser_();

        assert.neverCalledWith(session.overwriteCommand, "getPuppeteer");
    });

    it('should only overwrite timeouts wrapper if "browserWSEndpoint" is not specified', async () => {
        const session = mkSessionStub_();

        await initBrowser_({ session });

        assert.equal(session.overwriteCommand.withArgs("getPuppeteer").callCount, 1);
    });

    it("should overwrite command", async () => {
        const session = mkSessionStub_();
        const browser = mkBrowser_({ browserWSEndpoint: "ws://foo.bar/devtools" }, undefined, ExistingBrowser);

        await initBrowser_({ browser, session });

        assert.calledWith(session.overwriteCommand, "getPuppeteer", sinon.match.func);
    });

    describe("before call original command", () => {
        [
            {
                name: '"alwaysMatch" capability',
                fieldName: "alwaysMatch.se:cdp",
                capabilities: {
                    alwaysMatch: { "se:cdp": "ws://old.endpoint/devtools" },
                },
            },
            {
                name: "main capabilities",
                fieldName: "se:cdp",
                capabilities: { "se:cdp": "ws://old.endpoint/devtools" },
            },
        ].forEach(({ name, fieldName, capabilities }) => {
            it(`should overwrite "se:cdp" in ${name}`, async () => {
                const session = mkSessionStub_();
                session.capabilities = capabilities;
                session.sessionId = "100500";

                const origGetPuppeteerFn = session.getPuppeteer;
                let capsBeforeReset;

                origGetPuppeteerFn.callsFake(() => {
                    capsBeforeReset = _.cloneDeep(session.capabilities);

                    return Promise.resolve();
                });

                const browser = mkBrowser_(
                    { browserWSEndpoint: "ws://new.endpoint/devtools" },
                    undefined,
                    ExistingBrowser,
                );

                await initBrowser_({ browser, session });
                await session.getPuppeteer();

                assert.equal(_.get(capsBeforeReset, fieldName), "ws://new.endpoint/devtools/100500");
            });
        });
    });

    describe("after call original command", () => {
        [
            {
                name: '"alwaysMatch" capability',
                fieldName: "alwaysMatch.se:cdp",
                capabilities: {
                    alwaysMatch: { "se:cdp": "ws://old.endpoint/devtools" },
                },
            },
            {
                name: "main capabilities",
                fieldName: "se:cdp",
                capabilities: { "se:cdp": "ws://old.endpoint/devtools" },
            },
        ].forEach(({ name, fieldName, capabilities }) => {
            it(`should restore "se:cdp" in ${name}`, async () => {
                const session = mkSessionStub_();
                session.capabilities = capabilities;
                session.sessionId = "100500";
                const browser = mkBrowser_(
                    { browserWSEndpoint: "ws://new.endpoint/devtools" },
                    undefined,
                    ExistingBrowser,
                );

                await initBrowser_({ browser, session });
                await session.getPuppeteer();

                assert.equal(_.get(session.capabilities, fieldName), "ws://old.endpoint/devtools");
            });
        });
    });
});
