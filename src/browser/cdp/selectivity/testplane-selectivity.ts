import path from "path";
import { Module as UntypedModule } from "module";
import { AsyncLocalStorage } from "async_hooks";

const TypedModule = UntypedModule as unknown as {
    _load: (...args: any) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any
    _resolveFilename: (...args: any) => string; // eslint-disable-line @typescript-eslint/no-explicit-any
};
const testDependenciesStorage = new AsyncLocalStorage<{ jsTestplaneDeps?: Set<string> }>();
const testFileDependenciesCache = new Map<string, string[]>();

let disableCollectingDependenciesCb: (() => void) | null = null;

export const disableCollectingTestplaneDependencies = (): void => {
    if (disableCollectingDependenciesCb) {
        disableCollectingDependenciesCb();
        disableCollectingDependenciesCb = null;
    }
};

export const enableCollectingTestplaneDependencies = (): void => {
    if (disableCollectingDependenciesCb) {
        return;
    }

    const originalModuleLoad = TypedModule._load;

    disableCollectingDependenciesCb = (): void => {
        TypedModule._load = originalModuleLoad;
    };

    TypedModule._load = function (): unknown {
        try {
            const store = disableCollectingDependenciesCb ? testDependenciesStorage.getStore() : null;
            // eslint-disable-next-line prefer-rest-params
            const absPath = store ? TypedModule._resolveFilename.apply(this, arguments) : null;
            const relPath = absPath && path.isAbsolute(absPath) ? path.relative(process.cwd(), absPath) : null;

            if (store && relPath) {
                const posixRelPath =
                    path.sep === path.posix.sep ? relPath : relPath.replaceAll(path.sep, path.posix.sep);
                store.jsTestplaneDeps?.add(posixRelPath);
            }
        } catch {} // eslint-disable-line no-empty

        // eslint-disable-next-line prefer-rest-params
        return originalModuleLoad.apply(this, arguments);
    };
};

export const getCollectedTestplaneDependencies = (): string[] => {
    const store = testDependenciesStorage.getStore();

    return store && store.jsTestplaneDeps ? Array.from(store.jsTestplaneDeps).sort() : [];
};

export const runWithTestplaneDependenciesCollecting = <T>(fn: () => Promise<T>): Promise<T> => {
    enableCollectingTestplaneDependencies();

    const store = { jsTestplaneDeps: new Set<string>() };

    return testDependenciesStorage.run(store, fn);
};

export const readTestFileWithTestplaneDependenciesCollecting = <T>(file: string, fn: () => Promise<T>): Promise<T> => {
    if (!disableCollectingDependenciesCb) {
        return fn();
    }

    const store = testDependenciesStorage.getStore();
    const jsTestplaneDeps = store && store.jsTestplaneDeps;

    if (!jsTestplaneDeps) {
        return fn();
    }

    const cachedDependencies = testFileDependenciesCache.get(file);

    if (cachedDependencies) {
        cachedDependencies.forEach(dependency => jsTestplaneDeps.add(dependency));

        return fn();
    }

    return fn().finally(() => {
        testFileDependenciesCache.set(file, Array.from(jsTestplaneDeps).sort());
    });
};
