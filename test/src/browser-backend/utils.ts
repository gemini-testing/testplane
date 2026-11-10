import proxyquire from "proxyquire";
import sinon from "sinon";
import type * as BackendUtils from "src/browser-backend/utils";
import { createBrowserConfig_, mkSessionStub_ } from "../browser/utils";

describe("browser-backend/utils", () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => sandbox.restore());

    [null, undefined].forEach(deleteError => {
        it(`should tolerate session deletion rejecting with ${String(deleteError)}`, async () => {
            const warn = sandbox.stub();
            const { deleteWebdriverSession } = proxyquire("src/browser-backend/utils", {
                "../utils/logger": { warn },
            }) as typeof BackendUtils;
            const session = mkSessionStub_();
            session.deleteSession.callsFake(() => Promise.reject(deleteError));

            const deleted = await deleteWebdriverSession(session, createBrowserConfig_().forBrowser());

            assert.isFalse(deleted);
            assert.calledOnceWith(warn, sinon.match(/^WARNING: Can not close session:/));
        });
    });
});
