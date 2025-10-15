"use strict";

const { mkExistingBrowser_: mkBrowser_, mkSessionStub_ } = require("../utils");
const proxyquire = require("proxyquire");

describe('"runStep" command', () => {
    const sandbox = sinon.createSandbox();
    let ExistingBrowser, webdriverioAttachStub;

    beforeEach(() => {
        webdriverioAttachStub = sandbox.stub();

        const initCommandHistoryStub = sandbox.stub().returns({
            callstack: {
                enter: sandbox.stub(),
                leave: sandbox.stub(),
                markError: sandbox.stub(),
                release: sandbox.stub(),
                clear: sandbox.stub(),
            },
            snapshotsPromiseRef: { current: Promise.resolve() },
        });

        ExistingBrowser = proxyquire("src/browser/existing-browser", {
            "@testplane/webdriverio": {
                attach: webdriverioAttachStub,
            },
            "./browser": proxyquire("src/browser/browser", {
                "./history": {
                    initCommandHistory: initCommandHistoryStub,
                },
            }),
            "./client-bridge": {
                build: sandbox.stub().resolves(),
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

    it("should add `runStep` command", async () => {
        const session = mkSessionStub_();

        await initBrowser_({ session });

        assert.calledWith(session.addCommand, "runStep", sinon.match.func);
    });

    it("should throw if first argument is not a string", async () => {
        const session = mkSessionStub_();
        await initBrowser_({ session });

        assert.throws(() => session.runStep(100500, () => {}), /must be a string, but got number/);
    });

    it("should throw if second argument is not a function", async () => {
        const session = mkSessionStub_();
        await initBrowser_({ session });

        assert.throws(() => session.runStep("stepName", 100500), /must be a function, but got number/);
    });

    it("should call passed callback", async () => {
        const fnStub = sandbox.stub();
        const session = mkSessionStub_();
        await initBrowser_({ session });

        await session.runStep("stepName", fnStub);

        assert.calledOnceWith(fnStub);
    });
});
