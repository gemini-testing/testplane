"use strict";

const proxyquire = require("proxyquire").noCallThru();

describe("runInEachDisplayedIframe", () => {
    const sandbox = sinon.createSandbox();
    const first = { "element-6066-11e4-a52e-4f735466cecf": "first" };
    const second = { "element-6066-11e4-a52e-4f735466cecf": "second" };
    let session;
    let callback;
    let runInEachDisplayedIframe;
    let visibilityScript;
    let loadEsm;
    let warn;

    beforeEach(() => {
        visibilityScript = () => true;
        loadEsm = sandbox.stub().resolves({ default: visibilityScript });
        warn = sandbox.stub();
        ({ runInEachDisplayedIframe } = proxyquire("src/browser/screen-shooter/operations/iframe", {
            "../../../utils/preload-utils": { loadEsm },
            "../../../utils/logger": { warn },
        }));
        session = {
            findElements: sandbox.stub().resolves([first, second]),
            execute: sandbox.stub().resolves(true),
            switchToFrame: sandbox.stub().resolves(),
        };
        callback = sandbox.stub().resolves();
    });

    afterEach(() => sandbox.restore());

    it("should check visibility without creating a selectorless WDIO element", async () => {
        await runInEachDisplayedIframe(session, callback);

        assert.calledOnceWithExactly(loadEsm, "@testplane/webdriverio/scripts/isElementDisplayed.js");
        assert.calledOnceWithExactly(session.findElements, "css selector", "iframe[src]");
        assert.calledWithExactly(session.execute, visibilityScript, first);
        assert.calledWithExactly(session.execute, visibilityScript, second);
        assert.deepEqual(session.switchToFrame.args, [[first], [null], [second], [null]]);
        assert.calledTwice(callback);
        assert.callOrder(session.execute, session.switchToFrame, callback);
    });

    it("should skip hidden iframes", async () => {
        session.execute.onFirstCall().resolves(false);

        await runInEachDisplayedIframe(session, callback);

        assert.deepEqual(session.switchToFrame.args, [[second], [null]]);
        assert.calledOnce(callback);
    });

    it("should handle an empty iframe list", async () => {
        session.findElements.resolves([]);

        await runInEachDisplayedIframe(session, callback);

        assert.notCalled(session.execute);
        assert.notCalled(session.switchToFrame);
        assert.notCalled(callback);
    });

    for (const command of ["execute", "switchToFrame"]) {
        for (const errorCode of ["stale element reference", "no such frame"]) {
            for (const field of ["name", "error"]) {
                it(`should skip an iframe when ${command} fails with ${errorCode} in ${field}`, async () => {
                    session[command]
                        .onFirstCall()
                        .rejects(Object.assign(new Error("disappeared"), { [field]: errorCode }));

                    await runInEachDisplayedIframe(session, callback);

                    assert.calledOnce(callback);
                    assert.calledWithExactly(session.switchToFrame, second);
                    assert.deepEqual(session.switchToFrame.lastCall.args, [null]);
                    assert.calledOnce(warn);
                });
            }
        }

        it(`should propagate unexpected ${command} errors`, async () => {
            const error = new Error("connection lost");
            session[command].onFirstCall().rejects(error);

            assert.strictEqual(await assert.isRejected(runInEachDisplayedIframe(session, callback)), error);

            assert.notCalled(callback);
            assert.notCalled(warn);
        });
    }

    for (const name of ["Error", "stale element reference", "no such frame"]) {
        it(`should restore the top frame and propagate a callback ${name}`, async () => {
            const error = Object.assign(new Error("callback failed"), { name });
            callback.rejects(error);

            assert.strictEqual(await assert.isRejected(runInEachDisplayedIframe(session, callback)), error);

            assert.deepEqual(session.switchToFrame.args, [[first], [null]]);
            assert.calledOnce(callback);
            assert.notCalled(warn);
        });
    }
});
