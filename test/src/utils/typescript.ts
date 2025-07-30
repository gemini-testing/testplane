import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import _ from "lodash";

describe("utils/typescript", () => {
    const processEnvBackup = _.clone(process.env);

    let ts: typeof import("src/utils/typescript");
    let addHookStub: SinonStub;
    const TESTPLANE_TRANSFORM_HOOK = Symbol.for("testplane.transform.hook");

    beforeEach(() => {
        addHookStub = sinon.stub();
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

            assert.calledOnce(addHookStub);
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
});
