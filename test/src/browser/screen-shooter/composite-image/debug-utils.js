"use strict";

const proxyquire = require("proxyquire");

describe("composite image debug utils", () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => sandbox.restore());

    it("should not initialize jsquash on module load", () => {
        const loadEsmStub = sandbox.stub().resolves({
            init: sandbox.stub().resolves(),
            decode: sandbox.stub().resolves(),
        });

        proxyquire("src/browser/screen-shooter/composite-image/debug-utils", {
            "../../../utils/preload-utils": { loadEsm: loadEsmStub },
        });

        assert.notCalled(loadEsmStub);
    });
});
