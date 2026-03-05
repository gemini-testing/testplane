import path from "path";
import { Module as UntypedModule } from "module";
import { AsyncLocalStorage } from "async_hooks";
import { CacheType, getCachedSelectivityFile, setCachedSelectivityFile } from "./fs-cache";
import { debugSelectivity } from "./debug";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TypedModule = UntypedModule as unknown as { _resolveFilename: (...args: any) => string | void };
const testDependenciesStorage = new AsyncLocalStorage<{ jsTestplaneDeps?: Set<string> }>();
const testFileDependenciesRamCache = new Map<string, string[]>();

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

    const originalResolveFileName = TypedModule._resolveFilename;

    disableCollectingDependenciesCb = (): void => {
        TypedModule._resolveFilename = originalResolveFileName;
    };

    TypedModule._resolveFilename = function (): string | void {
        // eslint-disable-next-line prefer-rest-params
        const result = originalResolveFileName.apply(this, arguments);

        try {
            const store = disableCollectingDependenciesCb ? testDependenciesStorage.getStore() : null;
            const relPath = result && path.isAbsolute(result) ? path.relative(process.cwd(), result) : null;

            if (store && relPath) {
                const posixRelPath =
                    path.sep === path.posix.sep ? relPath : relPath.replaceAll(path.sep, path.posix.sep);
                store.jsTestplaneDeps?.add(posixRelPath);
            }
        } catch {} // eslint-disable-line no-empty

        return result;
    };
};

export const getCollectedTestplaneDependencies = (): Set<string> | null => {
    const store = testDependenciesStorage.getStore();

    return store && store.jsTestplaneDeps ? store.jsTestplaneDeps : null;
};

export const runWithTestplaneDependenciesCollecting = <T>(fn: () => Promise<T>): Promise<T> => {
    enableCollectingTestplaneDependencies();

    const store: { jsTestplaneDeps?: Set<string> } = { jsTestplaneDeps: new Set() };

    return testDependenciesStorage.run(store, fn).finally(() => {
        // After "fn" completion, "store" is reachable in CDP ping interval callback, so it never GC-removed
        // Thats why we do it manually. Removing "jsTestplaneDeps" is enough, and set remains unchanged, if used
        delete store.jsTestplaneDeps;
    });
};

export const readTestFileWithTestplaneDependenciesCollecting = async <T>(
    file: string,
    fn: () => Promise<T>,
): Promise<T> => {
    if (!disableCollectingDependenciesCb) {
        return fn();
    }

    const store = testDependenciesStorage.getStore();
    const jsTestplaneDeps = store && store.jsTestplaneDeps;

    if (!jsTestplaneDeps) {
        return fn();
    }

    const ramCachedDependencies = testFileDependenciesRamCache.get(file);

    if (ramCachedDependencies) {
        ramCachedDependencies.forEach(dependency => jsTestplaneDeps.add(dependency));

        return fn();
    }

    const fsCachedDependencies = await getCachedSelectivityFile(CacheType.TestFile, file);

    if (fsCachedDependencies) {
        let parsedDependencies: string[];
        try {
            parsedDependencies = JSON.parse(fsCachedDependencies) as string[];
        } catch (cause) {
            const lines: string[] = [];
            lines.push(
                `What happened: Selectivity fs-cache for test file "${file}" is corrupted — the cache contents are not valid JSON.`,
            );
            lines.push("\nPossible reasons:");
            lines.push("  - The cache file was partially written (e.g. process killed during write)");
            lines.push("  - The cache file was manually edited or corrupted by another tool");
            lines.push("\nWhat you can do:");
            lines.push("  - Delete the selectivity cache directory and re-run the tests to regenerate the cache");
            lines.push("  - Check the OS temp directory for the selectivity cache files");
            throw new Error(lines.join("\n"), { cause });
        }

        parsedDependencies.forEach(dependency => jsTestplaneDeps.add(dependency));

        return fn();
    }

    try {
        return await fn();
    } finally {
        const cacheValue = Array.from(jsTestplaneDeps).sort((a, b) => a.localeCompare(b));

        await setCachedSelectivityFile(CacheType.TestFile, file, JSON.stringify(cacheValue)).catch(err => {
            testFileDependenciesRamCache.set(file, cacheValue);

            debugSelectivity(`Couldn't offload test dependencies from "${file}" to fs-cache: %O`, err);
        });
    }
};
