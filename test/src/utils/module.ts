import path from "path";
import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import { requireModule as realRequireModule } from "../../../src/utils/module";

describe("utils/module", () => {
    let isNodeModuleRequired: SinonStub;
    let isLocalModuleRequired: SinonStub;
    let exists: SinonStub;
    let requireModule: typeof realRequireModule;

    const sandbox = sinon.createSandbox();
    const nodeModulePath = "foo-module";
    const relativeLocalModulePath = "./bar-module";
    const absoluteLocalModulePath = path.resolve(relativeLocalModulePath);

    beforeEach(() => {
        isNodeModuleRequired = sinon.stub();
        isLocalModuleRequired = sinon.stub();
        exists = sinon.stub();

        ({ requireModule } = proxyquire.noCallThru().load("../../../src/utils/module", {
            "./fs": { exists },
            [nodeModulePath]: isNodeModuleRequired,
            [absoluteLocalModulePath]: isLocalModuleRequired,
        }));
    });

    afterEach(() => sandbox.restore());

    describe("requireModule", () => {
        it("should require module from node-modules", async () => {
            exists.withArgs(nodeModulePath).resolves(false);
            const module = await requireModule<SinonStub>(nodeModulePath);

            module();

            assert.calledOnce(isNodeModuleRequired);
            assert.notCalled(isLocalModuleRequired);
        });

        it("should require module from node-modules", async () => {
            exists.withArgs(relativeLocalModulePath).resolves(true);
            const module = await requireModule<SinonStub>(relativeLocalModulePath);

            module();

            assert.calledOnce(isLocalModuleRequired);
            assert.notCalled(isNodeModuleRequired);
        });
    });
});
