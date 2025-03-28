"use strict";

const { mkExistingBrowser_: mkBrowser_, mkSessionStub_ } = require("../utils");
const proxyquire = require("proxyquire");

describe('"setOrientation" command', () => {
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

    it("should not overwrite command `setOrientation` if it does not exist`", async () => {
        const session = mkSessionStub_();
        session.setOrientation = undefined;

        await initBrowser_({ session });

        assert.neverCalledWith(session.overwriteCommand, "setOrientation");
    });

    it("should overwrite `setOrientation` command", async () => {
        const session = mkSessionStub_();

        await initBrowser_({ session });

        assert.calledWith(session.overwriteCommand, "setOrientation", sinon.match.func);
    });

    it("should not throw if orientation does not return current state", async () => {
        const session = mkSessionStub_();
        const origSetOrientationFn = session.setOrientation;
        origSetOrientationFn.resolves(null);

        await initBrowser_({ session });

        await assert.isFulfilled(session.setOrientation("portrait"));
    });

    describe("if new orientation does not differ from the current one", () => {
        let session;

        beforeEach(() => {
            session = mkSessionStub_();
            const origSetOrientationFn = session.setOrientation;
            origSetOrientationFn.withArgs("portrait").resolves("Already in portrait");
        });

        it("should return orientation", async () => {
            await initBrowser_({ session });

            const orientation = await session.setOrientation("portrait");

            assert.equal(orientation, "Already in portrait");
        });

        it("should not wait for orientation change", async () => {
            await initBrowser_({ session });

            await session.setOrientation("portrait");

            assert.notCalled(session.waitUntil);
        });
    });

    it("should return changed orientation if it differs from the current one", async () => {
        const session = mkSessionStub_();
        const origSetOrientationFn = session.setOrientation;
        origSetOrientationFn.resolves("portrait");
        await initBrowser_({ session });

        const orientation = await session.setOrientation("portrait");

        assert.equal(orientation, "portrait");
    });

    describe('if option "waitOrientationChange" set to false', () => {
        let session;

        beforeEach(() => {
            session = mkSessionStub_();
            const origSetOrientationFn = session.setOrientation;
            origSetOrientationFn.resolves("portrait");
        });

        it("should not get initial body width", async () => {
            const browser = mkBrowser_({ waitOrientationChange: false }, undefined, ExistingBrowser);
            await initBrowser_({ browser, session });

            await session.setOrientation("portrait");

            assert.notCalled(session.execute);
        });

        it("should not wait for orientation change", async () => {
            const browser = mkBrowser_({ waitOrientationChange: false }, undefined, ExistingBrowser);
            await initBrowser_({ browser, session });

            await session.setOrientation("portrait");

            assert.notCalled(session.waitUntil);
        });
    });

    it("should wait for orientation change", async () => {
        const session = mkSessionStub_();
        const origSetOrientationFn = session.setOrientation;
        origSetOrientationFn.resolves("portrait");
        await initBrowser_({ session });

        await session.setOrientation("portrait");

        assert.callOrder(session.setOrientation, session.waitUntil);
    });

    it("should wait for orientation change using a timeout from a browser config", async () => {
        const session = mkSessionStub_();
        const browser = mkBrowser_({ waitTimeout: 100500 }, undefined, ExistingBrowser);
        await initBrowser_({ browser, session });

        await session.setOrientation("portrait");

        assert.calledOnceWith(
            session.waitUntil,
            sinon.match.func,
            100500,
            "Orientation did not changed to 'portrait' in 100500 ms",
        );
    });
});
