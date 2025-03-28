import sinon, { SinonStub } from "sinon";

import { mkExistingBrowser_ as mkBrowser_, mkSessionStub_ } from "../utils";

import type { ExistingBrowser as ExistingBrowserOriginal } from "src/browser/existing-browser";
import { Calibrator } from "src/browser/calibrator";
import proxyquire from "proxyquire";

describe('"clearSession" command', () => {
    const sandbox = sinon.createSandbox();
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
            "./commands/clearSession": proxyquire("src/browser/commands/clearSession", {
                "../../utils/logger": {
                    warn: loggerWarnStub,
                },
            }),
        }).ExistingBrowser;

        global.window = {
            localStorage: { clear: sinon.stub() } as unknown as Storage,
            sessionStorage: { clear: sinon.stub() } as unknown as Storage,
        } as unknown as Window & typeof globalThis;
    });

    afterEach(() => {
        global.window = undefined as unknown as Window & typeof globalThis;
        sandbox.restore();
    });

    it("should add command", async () => {
        const session = mkSessionStub_();

        await initBrowser_({ session });

        assert.calledWith(session.addCommand, "clearSession", sinon.match.func);
    });

    it("should delete all cookies", async () => {
        const session = mkSessionStub_();

        await initBrowser_({ session });
        await session.clearSession();

        assert.calledOnce(session.deleteAllCookies);
    });

    (["localStorage", "sessionStorage"] as const).forEach(storageName => {
        describe(storageName, () => {
            it("should clear", async () => {
                const session = mkSessionStub_();
                session.execute.callsFake((cb: (storageName: string) => void, storageName: string) => cb(storageName));

                await initBrowser_({ session });
                await session.clearSession();

                assert.calledOnce(global.window[storageName].clear as SinonStub);
            });

            it("should not throw is storage is not available on the page", async () => {
                const err = new Error(
                    `Failed to read the '${storageName}' property from 'Window': Storage is disabled inside 'data:' URLs.`,
                );
                (global.window[storageName].clear as SinonStub).throws(err);

                const session = mkSessionStub_();
                session.execute.callsFake((cb: (storageName: string) => void, storageName: string) => cb(storageName));

                await initBrowser_({ session });

                await assert.isFulfilled(session.clearSession());
                assert.calledOnceWith(loggerWarnStub, `Couldn't clear ${storageName}: ${err.message}`);
            });

            it("should throw if clear storage fails with not handled error", async () => {
                const err = new Error("o.O");
                (global.window[storageName].clear as SinonStub).throws(err);

                const session = mkSessionStub_();
                session.execute.callsFake((cb: (storageName: string) => void, storageName: string) => cb(storageName));

                await initBrowser_({ session });

                await assert.isRejected(session.clearSession(), /o.O/);
            });
        });
    });
});
