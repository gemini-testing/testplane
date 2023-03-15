"use strict";

const webdriverio = require("webdriverio");
const history = require("src/browser/history");
const { mkExistingBrowser_: mkBrowser_, mkSessionStub_ } = require("../utils");

describe('"runStep" command', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(webdriverio, "attach");
        sandbox.stub(history, "initCommandHistory").returns(null);
    });

    afterEach(() => sandbox.restore());

    const initBrowser_ = ({ browser = mkBrowser_(), session = mkSessionStub_() } = {}) => {
        webdriverio.attach.resolves(session);

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
