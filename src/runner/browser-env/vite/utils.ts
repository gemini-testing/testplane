import url from "node:url";
import path from "node:path";

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

// TODO: use from browser code after migrate to esm
export const prepareError = (error: Error): Error => {
    return JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
};
