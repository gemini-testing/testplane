import * as webdriverio from "webdriverio";
import sinon, { SinonStub } from "sinon";

import clientBridge from "src/browser/client-bridge";
import logger from "src/utils/logger";
import { mkExistingBrowser_ as mkBrowser_, mkSessionStub_ } from "../utils";

import type ExistingBrowser from "src/browser/existing-browser";

describe('"clearSession" command', () => {
    const sandbox = sinon.sandbox.create();

    const initBrowser_ = ({ browser = mkBrowser_(), session = mkSessionStub_() } = {}): Promise<ExistingBrowser> => {
        (webdriverio.attach as SinonStub).resolves(session);

        return browser.init({ sessionId: session.sessionId, sessionCaps: session.capabilities, sessionOpts: {} });
    };

    beforeEach(() => {
        sandbox.stub(webdriverio, "attach");
        sandbox.stub(clientBridge, "build").resolves();
        sandbox.stub(logger, "warn");

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
                assert.calledOnceWith(logger.warn, `Couldn't clear ${storageName}: ${err.message}`);
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
