import fs from "fs";
import sinon, { SinonStub } from "sinon";
import { exists } from "../../../src/utils/fs";

describe("utils/fs", () => {
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
        sandbox.stub(fs.promises, "access");
    });

    afterEach(() => sandbox.restore());

    describe("exists", () => {
        it("should return 'true' if file exists", async () => {
            const path = "./some-path.js";
            (fs.promises.access as SinonStub).withArgs(path).resolves();

            const isExists = await exists(path);

            assert.isTrue(isExists);
        });

        it("should return 'false' if file doesn't exists", async () => {
            const path = "./some-path.js";
            (fs.promises.access as SinonStub).withArgs(path).rejects(new Error("o.O"));

            const isExists = await exists(path);

            assert.isFalse(isExists);
        });
    });
});
