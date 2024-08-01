import url from "node:url";
import path, { join, resolve } from "node:path";
import { builtinModules } from "node:module";
import { resolve as resolveExports } from "resolve.exports";
import { loadPackageJSON, resolveModule } from "local-pkg";

// TODO: use import.meta.url after migrate to esm
export const getImportMetaUrl = (path: string): string => {
    return url.pathToFileURL(path).toString();
};

export const getNodeModulePath = async ({
    moduleName,
    rootDir = process.cwd(),
    parent = "node_modules",
}: {
    moduleName: string;
    rootDir?: string;
    parent?: string;
}): Promise<string> => {
    const rootFileUrl = url.pathToFileURL(rootDir).href;

    // TODO: use import at the beginning of the file after migrate to esm
    const { resolve } = await eval(`import("import-meta-resolve")`);

    return resolve(moduleName, path.join(rootFileUrl, parent));
};

// Just copy-pasted from modern-node-polyfills to avoid potential errors
export const polyfillPath = async (moduleName: string): Promise<string> => {
    if (moduleName.startsWith("node:")) {
        moduleName = moduleName.replace("node:", "");
    }

    if (!builtinModules.includes(moduleName))
        throw new Error(`Node.js does not have ${moduleName} in its builtin modules`);

    const jspmPath = resolve(
        require.resolve(`@jspm/core/nodelibs/${moduleName}`),
        // ensure "fs/promises" is resolved properly
        "../../.." + (moduleName.includes("/") ? "/.." : ""),
    );
    const jspmPackageJson = await loadPackageJSON(jspmPath);
    const exportPath = resolveExports(jspmPackageJson, `./nodelibs/${moduleName}`, {
        browser: true,
    });

    const exportFullPath = resolveModule(join(jspmPath, exportPath?.[0] || ""));

    if (!exportPath || !exportFullPath) {
        throw new Error("resolving failed");
    }
    return exportFullPath;
};

// TODO: use from browser code after migrate to esm
export const prepareError = (error: Error): Error => {
    return JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
};
