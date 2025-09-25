import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import _ from "lodash";

describe("utils/typescript", () => {
    const processEnvBackup = _.clone(process.env);

    let ts: typeof import("src/utils/typescript");
    let addHookStub: SinonStub;
    let revertHookStub: SinonStub;
    const TESTPLANE_TRANSFORM_HOOK = Symbol.for("testplane.transform.hook");

    beforeEach(() => {
        revertHookStub = sinon.stub();
        addHookStub = sinon.stub().returns(revertHookStub);
        ts = proxyquire.noCallThru().load("src/utils/typescript", {
            pirates: {
                addHook: addHookStub,
            },
        });
    });

    afterEach(() => {
        _.set(process, TESTPLANE_TRANSFORM_HOOK, undefined);
        _.set(process, "env", processEnvBackup);
    });

    describe("registerTransformHook", () => {
        it("should add pirates hook", () => {
            ts.registerTransformHook();

            assert.calledTwice(addHookStub);
        });

        it("should not call register if typescript was already installed", () => {
            _.set(global, ["process", TESTPLANE_TRANSFORM_HOOK], true);

            ts.registerTransformHook();

            assert.notCalled(addHookStub);
        });

        it("should not call register if TS_ENABLE is false", () => {
            process.env.TS_ENABLE = "false";

            ts.registerTransformHook();

            assert.notCalled(addHookStub);

            process.env.TS_ENABLE = "undefined";
        });
    });

    describe("enableSourceMaps", () => {
        it("should not do anything if transform hook is not registered", () => {
            ts.enableSourceMaps();

            assert.notCalled(addHookStub);
        });

        it("should re-register transform hook with source maps", () => {
            ts.registerTransformHook();
            const addHookPrevCallCount = addHookStub.callCount;

            ts.enableSourceMaps();

            assert.calledOnce(revertHookStub);
            assert.equal(addHookStub.callCount, addHookPrevCallCount + 1);
        });
    });
});
