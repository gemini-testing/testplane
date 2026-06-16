import { pathToFileURL } from "node:url";
import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";

describe("utils/repl-module-hooks", () => {
    const TESTPLANE_REPL_MODULE_HOOK = Symbol.for("testplane.repl.module.hook");

    let registerHooksStub: SinonStub;
    let deregisterStub: SinonStub;
    let addHookStub: SinonStub;
    let instrumentStub: SinonStub;
    let loggerWarnStub: SinonStub;
    let replModuleHooks: typeof import("src/utils/repl-module-hooks");
    let isReplModeEnabled: boolean;

    const cleanupHook_ = (): void => {
        const processWithHook = process as typeof process & { [TESTPLANE_REPL_MODULE_HOOK]?: { revert: () => void } };

        processWithHook[TESTPLANE_REPL_MODULE_HOOK]?.revert();
        delete processWithHook[TESTPLANE_REPL_MODULE_HOOK];
    };

    const loadModule_ = ({ hasRegisterHooks = false }: { hasRegisterHooks?: boolean } = {}): void => {
        cleanupHook_();

        deregisterStub = sinon.stub();
        registerHooksStub = sinon.stub().returns({ deregister: deregisterStub });
        addHookStub = sinon.stub().returns(sinon.stub());
        isReplModeEnabled = true;
        instrumentStub = sinon.stub().callsFake((code: string) => {
            return isReplModeEnabled ? `${code}\n/* instrumented */` : code;
        });
        loggerWarnStub = sinon.stub();

        replModuleHooks = proxyquire.noCallThru().load("src/utils/repl-module-hooks", {
            "node:module": hasRegisterHooks ? { registerHooks: registerHooksStub } : {},
            pirates: { addHook: addHookStub },
            "./repl-instrumentation": { instrumentReplIfNeeded: instrumentStub },
            "./logger": { warn: loggerWarnStub },
        });
    };

    afterEach(() => {
        cleanupHook_();
        sinon.restore();
    });

    it("should use node module registerHooks when it is available", () => {
        loadModule_({ hasRegisterHooks: true });

        replModuleHooks.registerReplModuleHooks();

        assert.calledOnce(registerHooksStub);
        assert.notCalled(addHookStub);

        const loadHook = registerHooksStub.firstCall.args[0].load;
        const fileUrl = pathToFileURL("/tmp/spec.hermione.mjs").href;
        const result = loadHook(fileUrl, { format: "module" }, () => ({
            format: "module",
            source: "it('a', () => {})",
        }));

        assert.equal(result.source, "it('a', () => {})\n/* instrumented */");
        assert.calledOnceWith(instrumentStub, "it('a', () => {})", "/tmp/spec.hermione.mjs");
    });

    it("should fallback to pirates when registerHooks is not available", () => {
        loadModule_();

        replModuleHooks.registerReplModuleHooks();

        assert.calledOnce(addHookStub);
        assert.calledWithMatch(addHookStub, sinon.match.func, {
            exts: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"],
            ignoreNodeModules: true,
        });

        const hook = addHookStub.firstCall.args[0];
        const result = hook("it('a', () => {})", "/tmp/spec.hermione.ts");

        assert.equal(result, "it('a', () => {})\n/* instrumented */");
        assert.calledOnceWith(instrumentStub, "it('a', () => {})", "/tmp/spec.hermione.ts");
    });

    it("should not instrument sources outside repl mode", () => {
        loadModule_();
        isReplModeEnabled = false;

        replModuleHooks.registerReplModuleHooks();

        const hook = addHookStub.firstCall.args[0];
        const result = hook("it('a', () => {})", "/tmp/spec.hermione.ts");

        assert.equal(result, "it('a', () => {})");
        assert.calledOnceWith(instrumentStub, "it('a', () => {})", "/tmp/spec.hermione.ts");
    });

    it("should not instrument registerHooks sources outside repl mode", () => {
        loadModule_({ hasRegisterHooks: true });
        isReplModeEnabled = false;

        replModuleHooks.registerReplModuleHooks();

        const loadHook = registerHooksStub.firstCall.args[0].load;
        const fileUrl = pathToFileURL("/tmp/spec.hermione.mjs").href;
        const result = loadHook(fileUrl, { format: "module" }, () => ({
            format: "module",
            source: "it('a', () => {})",
        }));

        assert.equal(result.source, "it('a', () => {})");
        assert.calledOnceWith(instrumentStub, "it('a', () => {})", "/tmp/spec.hermione.mjs");
    });

    it("should keep original source if instrumentation fails", () => {
        loadModule_({ hasRegisterHooks: true });
        instrumentStub.throws(new Error("boom"));

        replModuleHooks.registerReplModuleHooks();

        const loadHook = registerHooksStub.firstCall.args[0].load;
        const fileUrl = pathToFileURL("/tmp/spec.hermione.mjs").href;
        const result = loadHook(fileUrl, { format: "module" }, () => ({
            format: "module",
            source: "it('a', () => {})",
        }));

        assert.equal(result.source, "it('a', () => {})");
        assert.calledOnceWithMatch(loggerWarnStub, "Failed to instrument /tmp/spec.hermione.mjs for REPL mode: boom.");
    });
});
