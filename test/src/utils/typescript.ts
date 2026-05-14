import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import _ from "lodash";
import RuntimeConfig from "src/config/runtime-config";
import { REPL_SCOPED_EVAL_CONTEXT_KEY, REPL_SCOPED_FN_FLAG } from "src/constants/repl";

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
        RuntimeConfig.getInstance().extend({ replMode: undefined });
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

    describe("transformCode", () => {
        it("should instrument test callback with scoped REPL if repl before test mode is enabled", () => {
            RuntimeConfig.getInstance().extend({ replMode: { enabled: true, beforeTest: true } });

            const result = ts.transformCode(
                `
                    const SOME_CONST = 1;
                    it("should work", async ({ browser }) => {
                        await browser.url("about:blank");
                    });
                `,
                { sourceFile: "/tmp/sample.testplane.ts", sourceMaps: false },
            );

            assert.include(result, REPL_SCOPED_EVAL_CONTEXT_KEY);
            assert.include(result, REPL_SCOPED_FN_FLAG);
            assert.match(result, /await __testplaneReplBrowser\.switchToRepl/);
            assert.match(result, /await browser\.url\("about:blank"\)/);
        });

        it("should not read browser from TDZ if test callback declares local browser", () => {
            RuntimeConfig.getInstance().extend({ replMode: { enabled: true, beforeTest: true } });

            const result = ts.transformCode(
                `
                    const SOMETHING = 123;
                    it("should work", async function() {
                        const { browser } = this;

                        console.log(SOMETHING);
                        await browser.url("about:blank");
                    });
                `,
                { sourceFile: "/tmp/sample.testplane.ts", sourceMaps: false },
            );

            assert.include(result, "this && this.browser || arguments[0]?.browser || globalThis.browser");
            assert.notInclude(result, 'typeof browser !== "undefined" && browser || this.browser');
        });

        it("should not instrument test callback if repl before test mode is disabled", () => {
            RuntimeConfig.getInstance().extend({ replMode: { enabled: true, beforeTest: false } });

            const result = ts.transformCode(
                `
                    it("should work", async ({ browser }) => {
                        await browser.url("about:blank");
                    });
                `,
                { sourceFile: "/tmp/sample.testplane.ts", sourceMaps: false },
            );

            assert.notInclude(result, REPL_SCOPED_EVAL_CONTEXT_KEY);
            assert.notInclude(result, REPL_SCOPED_FN_FLAG);
        });
    });
});
