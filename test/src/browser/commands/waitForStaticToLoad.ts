import sinon, { SinonStub } from "sinon";
import FakeTimers from "@sinonjs/fake-timers";

import { mkExistingBrowser_ as mkBrowser_, mkSessionStub_ as mkSessionStubOrigin_ } from "../utils";

import type { ExistingBrowser as ExistingBrowserOriginal } from "src/browser/existing-browser";
import { Calibrator } from "src/browser/calibrator";
import proxyquire from "proxyquire";
import type { WaitForStaticToLoadResult } from "src/browser/commands/waitForStaticToLoad";

type SessionOrigin = ReturnType<typeof mkSessionStubOrigin_>;
type Session = SessionOrigin & {
    waitForStaticToLoad(opts?: { timeout?: number; interval?: number }): Promise<WaitForStaticToLoadResult>;
};

const mkSessionStub_ = (): Session => {
    return mkSessionStubOrigin_() as Session;
};

describe('"waitForStaticToLoad" command', () => {
    const sandbox = sinon.createSandbox();
    let clock: FakeTimers.InstalledClock;
    let ExistingBrowser: typeof ExistingBrowserOriginal;
    let webdriverioAttachStub: SinonStub;
    let loggerWarnStub: SinonStub;

    const initBrowser_ = ({
        browser = mkBrowser_(undefined, undefined, ExistingBrowser),
        session = mkSessionStub_(),
    } = {}): Promise<ExistingBrowserOriginal> => {
        webdriverioAttachStub.resolves(session);

        return browser.init({ sessionId: session.sessionId, sessionCaps: session.capabilities }, {} as Calibrator);
    };

    beforeEach(() => {
        clock = FakeTimers.install();
        webdriverioAttachStub = sandbox.stub();
        loggerWarnStub = sandbox.stub();
        ExistingBrowser = proxyquire("src/browser/existing-browser", {
            "@testplane/webdriverio": {
                attach: webdriverioAttachStub,
            },
            "./client-bridge": {
                build: sandbox.stub().resolves(),
            },
            "../utils/logger": {
                warn: loggerWarnStub,
            },
            "./commands/waitForStaticToLoad": proxyquire("src/browser/commands/waitForStaticToLoad", {
                "../../utils/logger": {
                    warn: loggerWarnStub,
                },
            }),
        }).ExistingBrowser;
    });

    afterEach(async () => {
        await clock.runAllAsync();
        clock.uninstall();
        global.window = undefined as unknown as Window & typeof globalThis;
        sandbox.restore();
    });

    it("should add command", async () => {
        const session = mkSessionStub_();

        await initBrowser_({ session });

        assert.calledWith(session.addCommand, "waitForStaticToLoad", sinon.match.func);
    });

    it("should return ready true when page is ready immediately", async () => {
        const session = mkSessionStub_();
        session.execute.resolves({ ready: true });

        await initBrowser_({ session });

        const result = await session.waitForStaticToLoad();

        assert.deepEqual(result, { ready: true });
        assert.calledOnce(session.execute);
    });

    it("should use default timeout and interval from browser config", async () => {
        const browser = mkBrowser_({ waitTimeout: 5000, waitInterval: 100 }, undefined, ExistingBrowser);
        const session = mkSessionStub_();
        session.execute.resolves({ ready: true });

        await initBrowser_({ browser, session });

        await session.waitForStaticToLoad();

        assert.calledOnce(session.execute);
    });

    it("should use custom timeout and interval when provided", async () => {
        const session = mkSessionStub_();
        session.execute.resolves({ ready: true });

        await initBrowser_({ session });

        await session.waitForStaticToLoad({ timeout: 3000, interval: 50 });

        assert.calledOnce(session.execute);
    });

    it("should poll until page is ready", async () => {
        const session = mkSessionStub_();
        session.execute
            .onFirstCall()
            .resolves({ ready: false, reason: "Document is loading" })
            .onSecondCall()
            .resolves({ ready: false, reason: "Images loading" })
            .onThirdCall()
            .resolves({ ready: true });

        await initBrowser_({ session });

        const promise = session.waitForStaticToLoad({ timeout: 1000, interval: 100 });

        await clock.tickAsync(250);

        const result = await promise;

        assert.deepEqual(result, { ready: true });
        assert.calledThrice(session.execute);
    });

    it("should handle pending resources polling", async () => {
        const session = mkSessionStub_();
        session.execute
            .onFirstCall()
            .resolves({
                ready: false,
                reason: "Resources are not loaded",
                pendingResources: ["image1.jpg", "style.css"],
            })
            .onSecondCall()
            .resolves(["image1.jpg"]) // browserAreResourcesLoaded result
            .onThirdCall()
            .resolves([]); // browserAreResourcesLoaded result - all loaded

        await initBrowser_({ session });

        const promise = session.waitForStaticToLoad({ timeout: 1000, interval: 100 });

        await clock.tickAsync(250);

        const result = await promise;

        assert.deepEqual(result, { ready: true });
        assert.calledThrice(session.execute);
    });

    it("should return pending resources when not ready after timeout", async () => {
        const session = mkSessionStub_();
        session.execute
            .onFirstCall()
            .resolves({
                ready: false,
                reason: "Resources are not loaded",
                pendingResources: ["image1.jpg", "style.css"],
            })
            .resolves(["image1.jpg", "style.css"]);

        await initBrowser_({ session });

        const promise = session.waitForStaticToLoad({ timeout: 200, interval: 50 });

        await clock.tickAsync(250);

        const result = await promise;

        assert.deepEqual(result, {
            ready: false,
            reason: "Resources are not loaded",
            pendingResources: ["image1.jpg", "style.css"],
        });
    });

    it("should return reason when not ready after timeout", async () => {
        const session = mkSessionStub_();
        session.execute.resolves({ ready: false, reason: "Document is loading" });

        await initBrowser_({ session });

        const promise = session.waitForStaticToLoad({ timeout: 200, interval: 50 });

        await clock.tickAsync(250);

        const result = await promise;

        assert.deepEqual(result, { ready: false, reason: "Document is loading" });
    });

    it("should warn when timeout occurs with pending resources", async () => {
        const session = mkSessionStub_();
        session.execute
            .onFirstCall()
            .resolves({
                ready: false,
                reason: "Resources are not loaded",
                pendingResources: ["image1.jpg", "style.css"],
            })
            .resolves(["image1.jpg", "style.css"]);

        await initBrowser_({ session });

        const promise = session.waitForStaticToLoad({ timeout: 200, interval: 50 });

        await clock.tickAsync(250);

        await promise;

        assert.calledOnceWith(
            loggerWarnStub,
            "Timed out waiting for page to load in 200ms. Several resources are still not loaded:\n- image1.jpg\n- style.css",
        );
    });

    it("should warn when timeout occurs with reason", async () => {
        const session = mkSessionStub_();
        session.execute.resolves({ ready: false, reason: "Document is loading" });

        await initBrowser_({ session });

        const promise = session.waitForStaticToLoad({ timeout: 200, interval: 50 });

        await clock.tickAsync(250);

        await promise;

        assert.calledOnceWith(loggerWarnStub, "Timed out waiting for page to load in 200ms. Document is loading");
    });

    it("should not warn when page becomes ready before timeout", async () => {
        const session = mkSessionStub_();
        session.execute
            .onFirstCall()
            .resolves({ ready: false, reason: "Document is loading" })
            .onSecondCall()
            .resolves({ ready: true });

        await initBrowser_({ session });

        const promise = session.waitForStaticToLoad({ timeout: 1000, interval: 100 });

        await clock.tickAsync(150);

        await promise;

        assert.notCalled(loggerWarnStub);
    });

    it("should handle mixed polling scenarios", async () => {
        const session = mkSessionStub_();
        session.execute
            .onCall(0)
            .resolves({ ready: false, reason: "Document is loading" })
            .onCall(1)
            .resolves({
                ready: false,
                reason: "Resources are not loaded",
                pendingResources: ["image1.jpg", "style.css", "font.woff"],
            })
            .onCall(2)
            .resolves(["image1.jpg", "font.woff"]) // some resources loaded
            .onCall(3)
            .resolves(["font.woff"]) // more resources loaded
            .onCall(4)
            .resolves([]); // all resources loaded

        await initBrowser_({ session });

        const promise = session.waitForStaticToLoad({ timeout: 1000, interval: 50 });

        await clock.tickAsync(300);

        const result = await promise;

        assert.deepEqual(result, { ready: true });
        assert.callCount(session.execute, 5);
    });

    it("should handle timeout during resource polling", async () => {
        const session = mkSessionStub_();
        session.execute
            .onCall(0)
            .resolves({
                ready: false,
                reason: "Resources are not loaded",
                pendingResources: ["image1.jpg", "style.css"],
            })
            .resolves(["image1.jpg"]); // partially loaded

        await initBrowser_({ session });

        const promise = session.waitForStaticToLoad({ timeout: 150, interval: 50 });

        await clock.tickAsync(200);

        const result = await promise;

        assert.deepEqual(result, {
            ready: false,
            reason: "Resources are not loaded",
            pendingResources: ["image1.jpg"],
        });
        assert.calledWith(
            loggerWarnStub,
            "Timed out waiting for page to load in 150ms. Several resources are still not loaded:\n- image1.jpg",
        );
    });
});
