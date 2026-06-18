import { pathToFileURL } from "node:url";
import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";

describe("utils/repl-module-hooks", () => {
    const TESTPLANE_REPL_MODULE_HOOK = Symbol.for("testplane.repl.module.hook");
    const originalArgv = process.argv;

    let registerHooksStub: SinonStub;
    let deregisterStub: SinonStub;
    let addHookStub: SinonStub;
    let instrumentStub: SinonStub;
    let loggerWarnStub: SinonStub;
    let readFileSyncStub: SinonStub;
    let replModuleHooks: typeof import("src/utils/repl-module-hooks");
    let isReplModeEnabled: boolean;

    const cleanupHook_ = (): void => {
        const processWithHook = process as typeof process & { [TESTPLANE_REPL_MODULE_HOOK]?: { revert: () => void } };

        processWithHook[TESTPLANE_REPL_MODULE_HOOK]?.revert();
        delete processWithHook[TESTPLANE_REPL_MODULE_HOOK];
    };

    const loadModule_ = ({
        hasRegisterHooks = false,
        nodeVersion = "24.13.0",
        argv = ["--repl"],
    }: { hasRegisterHooks?: boolean; nodeVersion?: string; argv?: string[] } = {}): void => {
        cleanupHook_();
        process.argv = ["node", "testplane", ...argv];
        sinon.stub(process.versions, "node").value(nodeVersion);

        deregisterStub = sinon.stub();
        registerHooksStub = sinon.stub().returns({ deregister: deregisterStub });
        addHookStub = sinon.stub().returns(sinon.stub());
        readFileSyncStub = sinon.stub();
        isReplModeEnabled = true;
        instrumentStub = sinon.stub().callsFake((code: string) => {
            return isReplModeEnabled ? `${code}\n/* instrumented */` : code;
        });
        loggerWarnStub = sinon.stub();

        replModuleHooks = proxyquire.noCallThru().load("src/utils/repl-module-hooks", {
            "node:module": hasRegisterHooks ? { registerHooks: registerHooksStub } : {},
            "node:fs": { readFileSync: readFileSyncStub },
            pirates: { addHook: addHookStub },
            "./repl-instrumentation": { instrumentReplIfNeeded: instrumentStub },
            "./logger": { warn: loggerWarnStub },
        });
    };

    afterEach(() => {
        cleanupHook_();
        process.argv = originalArgv;
        sinon.restore();
    });

    it("should not register hooks outside repl mode", () => {
        loadModule_({ hasRegisterHooks: true, argv: [] });

        replModuleHooks.registerReplModuleHooks();

        assert.notCalled(registerHooksStub);
        assert.notCalled(addHookStub);
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

    it("should read file source when registerHooks returns null source", () => {
        loadModule_({ hasRegisterHooks: true });
        readFileSyncStub.returns("it('a', () => {})");

        replModuleHooks.registerReplModuleHooks();

        const loadHook = registerHooksStub.firstCall.args[0].load;
        const fileUrl = pathToFileURL("/tmp/spec.hermione.js").href;
        const result = loadHook(fileUrl, { format: "commonjs" }, () => ({
            format: "commonjs",
            source: null,
        }));

        assert.equal(result.source, "it('a', () => {})\n/* instrumented */");
        assert.calledOnceWith(readFileSyncStub, "/tmp/spec.hermione.js", "utf8");
        assert.calledOnceWith(instrumentStub, "it('a', () => {})", "/tmp/spec.hermione.js");
    });

    it("should keep original registerHooks result if null source cannot be read", () => {
        loadModule_({ hasRegisterHooks: true });
        readFileSyncStub.throws(new Error("boom"));

        replModuleHooks.registerReplModuleHooks();

        const loadHook = registerHooksStub.firstCall.args[0].load;
        const fileUrl = pathToFileURL("/tmp/spec.hermione.js").href;
        const result = loadHook(fileUrl, { format: "commonjs" }, () => ({
            format: "commonjs",
            source: null,
        }));

        assert.deepEqual(result, { format: "commonjs", source: null });
        assert.notCalled(instrumentStub);
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

    it("should fallback to pirates when registerHooks has broken mixed hook validation", () => {
        loadModule_({ hasRegisterHooks: true, nodeVersion: "22.18.0" });

        replModuleHooks.registerReplModuleHooks();

        assert.notCalled(registerHooksStub);
        assert.calledOnce(addHookStub);
    });

    it("should fallback to pirates on Node 24 versions before the instrumentation fix", () => {
        loadModule_({ hasRegisterHooks: true, nodeVersion: "24.12.0" });

        replModuleHooks.registerReplModuleHooks();

        assert.notCalled(registerHooksStub);
        assert.calledOnce(addHookStub);
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
