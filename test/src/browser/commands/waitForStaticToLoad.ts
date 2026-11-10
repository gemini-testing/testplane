import sinon, { type SinonStub } from "sinon";
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

    describe("in-page resources detection", () => {
        type FakeImage = { src: string; onload: (() => void) | null; onerror: (() => void) | null };

        const globalKeys = ["document", "window", "getComputedStyle", "Image"] as const;
        let originalGlobals: Record<string, unknown>;
        let performanceEntries: Array<{ name: string }>;
        let createdImages: FakeImage[];

        const mkStyle_ = (props: Record<string, string>): Record<string, unknown> => ({
            ...props,
            length: Object.keys(props).length,
            item: (i: number) => Object.keys(props)[i],
            getPropertyValue: (name: string) => props[name] || "",
        });

        const mkNode_ = (inlineStyle: Record<string, string>, computedStyle: Record<string, string>): unknown => ({
            clientWidth: 10,
            clientHeight: 10,
            style: mkStyle_(inlineStyle),
            computedStyle: mkStyle_(computedStyle),
        });

        const mkList_ = <T>(items: T[]): { length: number; item: (i: number) => T } => ({
            length: items.length,
            item: (i: number) => items[i],
        });

        const setupPage_ = ({
            inlineNodes = [] as unknown[],
            cssRules = [] as Array<{ selectorText: string; style: Record<string, string>; nodes: unknown[] }>,
        } = {}): void => {
            const g = global as unknown as Record<string, unknown>;

            g.document = {
                readyState: "complete",
                currentScript: null,
                fonts: { status: "loaded" },
                images: mkList_([]),
                styleSheets: mkList_([
                    {
                        cssRules: mkList_(
                            cssRules.map(rule => ({ selectorText: rule.selectorText, style: mkStyle_(rule.style) })),
                        ),
                    },
                ]),
                querySelectorAll: (selector: string): ReturnType<typeof mkList_> => {
                    if (selector === 'link[rel="stylesheet"]') {
                        return mkList_([]);
                    }

                    if (selector === '[style*="url("]') {
                        return mkList_(inlineNodes);
                    }

                    const rule = cssRules.find(r => r.selectorText === selector);

                    return mkList_(rule ? rule.nodes : []);
                },
            };
            g.window = {
                performance: { getEntriesByType: () => performanceEntries },
            };
            g.getComputedStyle = (node: { computedStyle: unknown }): unknown => node.computedStyle;
            g.Image = function (this: FakeImage): void {
                this.src = "";
                this.onload = null;
                this.onerror = null;
                createdImages.push(this);
            };
        };

        const initBrowserWithRealExecute_ = async (): Promise<Session> => {
            const session = mkSessionStub_();
            session.execute.callsFake((fn: (...args: unknown[]) => unknown, ...args: unknown[]) =>
                Promise.resolve(fn(...args)),
            );

            await initBrowser_({ session });

            return session;
        };

        beforeEach(() => {
            const g = global as unknown as Record<string, unknown>;

            originalGlobals = {};
            globalKeys.forEach(key => (originalGlobals[key] = g[key]));
            performanceEntries = [];
            createdImages = [];
        });

        afterEach(() => {
            const g = global as unknown as Record<string, unknown>;

            globalKeys.forEach(key => (g[key] = originalGlobals[key]));
        });

        it("should wait for each url of multi-layer background from inline styles separately", async () => {
            setupPage_({
                inlineNodes: [
                    mkNode_(
                        { backgroundImage: "url('/a.png'), url('/b.png')" },
                        { backgroundImage: 'url("http://h/a.png"), url("http://h/b.png")' },
                    ),
                ],
            });
            const session = await initBrowserWithRealExecute_();

            const promise = session.waitForStaticToLoad({ timeout: 100, interval: 50 });
            await clock.tickAsync(150);

            assert.deepEqual(await promise, {
                ready: false,
                reason: "Resources are not loaded",
                pendingResources: ["http://h/a.png", "http://h/b.png"],
            });
        });

        it("should wait for each url of multi-layer background from stylesheets separately", async () => {
            setupPage_({
                cssRules: [
                    {
                        selectorText: ".card",
                        style: { backgroundImage: "linear-gradient(red, blue), url(/a.png), url(/b.png)" },
                        nodes: [
                            mkNode_(
                                {},
                                {
                                    backgroundImage:
                                        'linear-gradient(rgb(255, 0, 0), rgb(0, 0, 255)), url("http://h/a.png"), url("http://h/b.png")',
                                },
                            ),
                        ],
                    },
                ],
            });
            const session = await initBrowserWithRealExecute_();

            const promise = session.waitForStaticToLoad({ timeout: 100, interval: 50 });
            await clock.tickAsync(150);

            assert.deepEqual(await promise, {
                ready: false,
                reason: "Resources are not loaded",
                pendingResources: ["http://h/a.png", "http://h/b.png"],
            });
        });

        it("should be ready when every url of multi-layer background is loaded", async () => {
            performanceEntries = [{ name: "http://h/a.png" }, { name: "http://h/b.png" }];
            setupPage_({
                inlineNodes: [
                    mkNode_(
                        { backgroundImage: 'url("/a.png"), url("/b.png")' },
                        { backgroundImage: 'url("http://h/a.png"), url("http://h/b.png")' },
                    ),
                ],
            });
            const session = await initBrowserWithRealExecute_();

            assert.deepEqual(await session.waitForStaticToLoad({ timeout: 100, interval: 50 }), { ready: true });
        });

        it("should skip data urls inside multi-layer background", async () => {
            performanceEntries = [{ name: "http://h/a.png" }];
            setupPage_({
                inlineNodes: [
                    mkNode_(
                        { backgroundImage: 'url("data:image/png;base64,AAAA"), url("/a.png")' },
                        { backgroundImage: 'url("data:image/png;base64,AAAA"), url("http://h/a.png")' },
                    ),
                ],
            });
            const session = await initBrowserWithRealExecute_();

            assert.deepEqual(await session.waitForStaticToLoad({ timeout: 100, interval: 50 }), { ready: true });
        });
    });
});
