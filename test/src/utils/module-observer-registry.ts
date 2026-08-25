import fs from "node:fs";
import { Module as UntypedModule } from "node:module";
import sinon from "sinon";

import { moduleObserverRegistry, type ModuleLoadObserver } from "src/utils/module-observer-registry";

type LoadInfo = Parameters<NonNullable<ModuleLoadObserver["onLoadStart"]>>[0];
type PatchableModule = typeof UntypedModule & {
    _resolveFilename: (request: string, ...args: unknown[]) => string | false;
    _load: (request: string, ...args: unknown[]) => unknown;
};

const Module = UntypedModule as PatchableModule;

describe("module observer registry", () => {
    it("should observe only scoped loads and restore CommonJS hooks", () => {
        const originalLoad = Module._load;
        const cachedModule = require.resolve("src/utils/promise");
        const starts: LoadInfo[] = [];
        const ends: Array<{ info: LoadInfo; token: unknown }> = [];
        const registration = moduleObserverRegistry.register({
            onLoadStart: info => {
                starts.push(info);
                return info.request;
            },
            onLoadEnd: (info, token) => ends.push({ info, token }),
        });

        require(cachedModule);
        assert.isEmpty(starts);
        registration.run(() => require(cachedModule));
        registration.dispose();

        assert.lengthOf(starts, 1);
        assert.lengthOf(ends, 1);
        assert.equal(starts[0].request, cachedModule);
        assert.isTrue(starts[0].cacheHit);
        assert.strictEqual(Module._load, originalLoad);
    });

    it("should fail open when an observer throws", () => {
        const onError = sinon.spy();
        const registration = moduleObserverRegistry.register({
            onLoadStart: () => {
                throw new Error("observer failed");
            },
            onError,
        });

        assert.strictEqual(
            registration.run(() => require("node:fs")),
            fs,
        );
        registration.dispose();
        assert.calledOnce(onError);
    });

    it("should not overwrite CommonJS hooks installed after the registry", () => {
        const originalLoad = Module._load;
        const originalResolve = Module._resolveFilename;
        const starts: LoadInfo[] = [];
        const registration = moduleObserverRegistry.register({});
        const registryLoad = Module._load;
        const registryResolve = Module._resolveFilename;
        const externalLoad: PatchableModule["_load"] = function (this: PatchableModule, request, ...args) {
            return registryLoad.call(this, request, ...args);
        };
        const externalResolve: PatchableModule["_resolveFilename"] = function (
            this: PatchableModule,
            request,
            ...args
        ) {
            return registryResolve.call(this, request, ...args);
        };

        try {
            Module._load = externalLoad;
            Module._resolveFilename = externalResolve;
            registration.dispose();

            assert.strictEqual(Module._load, externalLoad);
            assert.strictEqual(Module._resolveFilename, externalResolve);

            const nextRegistration = moduleObserverRegistry.register({
                onLoadStart: info => starts.push(info),
            });
            nextRegistration.run(() => require("node:fs"));
            nextRegistration.dispose();

            assert.lengthOf(starts, 1);
            assert.strictEqual(Module._load, externalLoad);
            assert.strictEqual(Module._resolveFilename, externalResolve);
        } finally {
            registration.dispose();
            Module._load = originalLoad;
            Module._resolveFilename = originalResolve;
        }
    });

    it("should observe ESM loads when synchronous module hooks are available", async function () {
        if (typeof Module.registerHooks !== "function") {
            this.skip();
        }
        const starts: LoadInfo[] = [];
        const registration = moduleObserverRegistry.register({
            onLoadStart: info => starts.push(info),
        });

        const importModule = new Function("specifier", "return import(specifier)") as (
            specifier: string,
        ) => Promise<unknown>;
        await registration.run(() => importModule(`data:text/javascript,export default 42#${Date.now()}`));
        registration.dispose();

        assert.isTrue(starts.some(info => info.moduleSystem === "esm"));
    });
});
