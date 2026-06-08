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
    let RuntimeConfigStub: { getInstance: SinonStub };
    let replModuleHooks: typeof import("src/utils/repl-module-hooks");

    const loadModule_ = ({ hasRegisterHooks = false }: { hasRegisterHooks?: boolean } = {}): void => {
        deregisterStub = sinon.stub();
        registerHooksStub = sinon.stub().returns({ deregister: deregisterStub });
        addHookStub = sinon.stub().returns(sinon.stub());
        instrumentStub = sinon.stub().callsFake((code: string) => `${code}\n/* instrumented */`);
        RuntimeConfigStub = {
            getInstance: sinon.stub().returns({ replMode: { enabled: true, beforeTest: false } }),
        };
        loggerWarnStub = sinon.stub();

        replModuleHooks = proxyquire.noCallThru().load("src/utils/repl-module-hooks", {
            "node:module": hasRegisterHooks ? { registerHooks: registerHooksStub } : {},
            pirates: { addHook: addHookStub },
            "../config/runtime-config": RuntimeConfigStub,
            "./repl-instrumentation": { instrumentReplIfNeeded: instrumentStub },
            "./logger": { warn: loggerWarnStub },
        });
    };

    afterEach(() => {
        const processWithHook = process as typeof process & { [TESTPLANE_REPL_MODULE_HOOK]?: { revert: () => void } };

        processWithHook[TESTPLANE_REPL_MODULE_HOOK]?.revert();
        delete processWithHook[TESTPLANE_REPL_MODULE_HOOK];
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
        RuntimeConfigStub.getInstance.returns({ replMode: { enabled: false, beforeTest: true } });

        replModuleHooks.registerReplModuleHooks();

        const hook = addHookStub.firstCall.args[0];
        const result = hook("it('a', () => {})", "/tmp/spec.hermione.ts");

        assert.equal(result, "it('a', () => {})");
        assert.notCalled(instrumentStub);
    });

    it("should not instrument registerHooks sources outside repl mode", () => {
        loadModule_({ hasRegisterHooks: true });
        RuntimeConfigStub.getInstance.returns({ replMode: { enabled: false, beforeTest: true } });

        replModuleHooks.registerReplModuleHooks();

        const loadHook = registerHooksStub.firstCall.args[0].load;
        const fileUrl = pathToFileURL("/tmp/spec.hermione.mjs").href;
        const result = loadHook(fileUrl, { format: "module" }, () => ({
            format: "module",
            source: "it('a', () => {})",
        }));

        assert.equal(result.source, "it('a', () => {})");
        assert.notCalled(instrumentStub);
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
