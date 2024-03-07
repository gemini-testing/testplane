import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import FakeTimers from "@sinonjs/fake-timers";
import PageLoader from "src/utils/page-loader";
import { DEVTOOLS_PROTOCOL } from "src/constants/config";
import { mkSessionStub_ as mkSessionStubOrigin_, mkExistingBrowser_ } from "../utils";
import type ExistingBrowser from "src/browser/existing-browser";

type SessionOrigin = ReturnType<typeof mkSessionStubOrigin_>;
type Session = SessionOrigin & { openAndWait(uri: string, opts: Record<string, unknown>): Promise<void> };

const mkSessionStub_ = (): Session => {
    return mkSessionStubOrigin_() as Session;
};

describe('"openAndWait" command', () => {
    const sandbox = sinon.createSandbox();
    let clock: FakeTimers.InstalledClock;
    const wdioAttachStub = sandbox.stub().resolves(mkSessionStub_());
    let mkBrowser_: typeof mkExistingBrowser_;

    beforeEach(() => {
        ({ mkExistingBrowser_: mkBrowser_ } = proxyquire("../utils", {
            webdriverio: { attach: wdioAttachStub, "@global": true },
            "./client-bridge": { build: sandbox.stub().resolves(), "@global": true },
        }));

        clock = FakeTimers.install();
        sandbox.stub(PageLoader.prototype, "unsubscribe");
    });

    afterEach(async () => {
        await clock.runAllAsync();
        clock.uninstall();
        sandbox.restore();
    });

    const mkPromiseCheck_ =
        (done: boolean, type: "resolved" | "rejected") =>
        async <T>(promise: Promise<T>, ms: number, reason?: string): Promise<void> => {
            let settled = false;

            const markSettled = (): void => {
                settled = true;
            };

            promise.then(markSettled).catch(markSettled);

            await clock.tickAsync(ms);

            if (!done) {
                assert.isFalse(settled);
                return;
            }

            if (type === "resolved") {
                await assert.isFulfilled(promise);
            } else {
                await assert.isRejected(promise, reason);
            }
        };

    const resolvedAfter_ = mkPromiseCheck_(true, "resolved");
    const rejectedAfter_ = mkPromiseCheck_(true, "rejected");
    const notResolvedAfter_ = mkPromiseCheck_(false, "resolved");
    const notRejectedAfer_ = mkPromiseCheck_(false, "rejected");

    const stubLoad_ = (func: () => Promise<void>): void => {
        sandbox.stub(PageLoader.prototype, "load").callsFake(func);
    };

    const emitAfter_ = function <T = void>(this: PageLoader, event: string, ms: number, eventArg?: T): Promise<void> {
        setTimeout(() => this.emit(event, eventArg), ms);
        return Promise.resolve();
    };

    const mkEmitAfter_ = <T = void>(event: string, ms: number, eventArg?: T) => {
        return function (this: PageLoader): Promise<void> {
            return emitAfter_.call(this, event, ms, eventArg);
        };
    };

    const initBrowser_ = ({ browser = mkBrowser_(), session = mkSessionStub_() } = {}): Promise<ExistingBrowser> => {
        wdioAttachStub.resolves(session);

        return browser.init({ sessionId: session.sessionId, sessionCaps: session.capabilities, sessionOpts: {} });
    };

    it("should add command", async () => {
        const session = mkSessionStub_();

        await initBrowser_({ session });

        assert.calledWith(session.addCommand, "openAndWait", sinon.match.func);
    });

    it("should wait for selectors", async () => {
        const session = mkSessionStub_();
        const element = await session.$(".selector");
        session.$ = sandbox.stub().resolves(element);
        stubLoad_(mkEmitAfter_("selectorsExist", 100));

        await initBrowser_({ session });

        const promise = session.openAndWait("some/url", { selector: ".selector", waitNetworkIdle: false });

        await Promise.all([notResolvedAfter_(promise, 50), resolvedAfter_(promise, 100)]);
    });

    it("should wait for predicate", async () => {
        const session = mkSessionStub_();
        stubLoad_(mkEmitAfter_("predicateResolved", 100));

        await initBrowser_({ session });

        const promise = session.openAndWait("some/url", { predicate: sandbox.stub(), waitNetworkIdle: false });

        await Promise.all([notResolvedAfter_(promise, 50), resolvedAfter_(promise, 100)]);
    });

    it("should wait for network idle", async () => {
        const browser = mkBrowser_({ automationProtocol: DEVTOOLS_PROTOCOL });
        const session = mkSessionStub_();
        stubLoad_(mkEmitAfter_("networkResolved", 100));

        await initBrowser_({ session, browser });

        const promise = session.openAndWait("some/url", { waitNetworkIdle: true });

        await Promise.all([notResolvedAfter_(promise, 50), resolvedAfter_(promise, 100)]);
    });

    it("should unsubscribe to pageLoader", async () => {
        const browser = mkBrowser_({ automationProtocol: DEVTOOLS_PROTOCOL });
        const session = mkSessionStub_();
        stubLoad_(mkEmitAfter_("networkResolved", 100));

        await initBrowser_({ session, browser });

        const promise = session.openAndWait("some/url", { waitNetworkIdle: true });

        assert.notCalled(PageLoader.prototype.unsubscribe as SinonStub);
        await resolvedAfter_(promise, 100);
        assert.calledOnce(PageLoader.prototype.unsubscribe as SinonStub);
    });

    ["pageLoadError", "selectorsError", "predicateError"].forEach(event => {
        it(`should handle '${event}' event`, async () => {
            const browser = mkBrowser_({ automationProtocol: DEVTOOLS_PROTOCOL });
            const session = mkSessionStub_();
            stubLoad_(mkEmitAfter_(event, 100, new Error("error message")));

            await initBrowser_({ session, browser });

            const promise = session.openAndWait("some/url", {
                selector: [".selector"],
                predicate: () => true,
                waitNetworkIdle: true,
            });

            await Promise.all([notRejectedAfer_(promise, 50), rejectedAfter_(promise, 100, "url: error message")]);
        });
    });

    describe("should handle 'networkError' event", () => {
        it("should not throw", async () => {
            const browser = mkBrowser_({ automationProtocol: DEVTOOLS_PROTOCOL });
            const session = mkSessionStub_();
            stubLoad_(function (this: PageLoader): Promise<void> {
                setTimeout(() => this.emit("networkError", { url: "content.url", statusCode: 404 }), 50);
                setTimeout(() => this.emit("networkResolved", 100));
                return Promise.resolve();
            });

            await initBrowser_({ session, browser });

            const promise = session.openAndWait("some/url", {
                waitNetworkIdle: true,
                waitNetworkIdleTimeout: 100,
                failOnNetworkError: true,
                shouldThrowError: () => false,
            });

            await resolvedAfter_(promise, 100);
        });

        it("should throw", async () => {
            const browser = mkBrowser_({ automationProtocol: DEVTOOLS_PROTOCOL });
            const session = mkSessionStub_();
            stubLoad_(mkEmitAfter_("networkError", 100, { url: "content.url", statusCode: 404 }));

            await initBrowser_({ session, browser });

            const promise = session.openAndWait("some/url", {
                waitNetworkIdle: true,
                waitNetworkIdleTimeout: 500,
                failOnNetworkError: true,
                shouldThrowError: () => true,
            });

            await rejectedAfter_(promise, 100, "url: couldn't get content from content.url: 404");
        });
    });
});
