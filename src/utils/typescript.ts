import path from "node:path";
import { addHook } from "pirates";
import * as recast from "recast";
import * as logger from "./logger";
import { isRunInBrowserEnv } from "./config";
import type { CommonConfig } from "../config/types";

const TESTPLANE_TRANSFORM_HOOK = Symbol.for("testplane.transform.hook");

const TRANSFORM_CODE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"];
const ASSET_EXTENSIONS = [
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".styl",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".woff",
    ".woff2",
];

type RecastParser = {
    parse(source: string, options?: unknown): unknown;
};

type ProcessWithTransformHook = typeof process & {
    [TESTPLANE_TRANSFORM_HOOK]?: { revert: () => void; enableSourceMaps: () => void };
};

let transformFunc: null | ((code: string, sourceFile: string, sourceMaps: boolean) => string) = null;
let shouldRemoveViteQueryImports: boolean = false;

export const transformCode = (
    code: string,
    { sourceFile, sourceMaps, isSilent = true }: { sourceFile: string; sourceMaps: boolean; isSilent?: boolean },
): string => {
    if (transformFunc === null) {
        const envVar = process.env.TS_NODE_SWC === "false" ? false : true;
        const hasSwcCore = (): boolean => {
            try {
                require.resolve("@swc/core");
                return true;
            } catch {
                if (!isSilent) {
                    logger.warn(
                        `testplane: you may install @swc/core for significantly faster reading of typescript tests.`,
                    );
                }
                return false;
            }
        };

        if (envVar && hasSwcCore()) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { transformSync }: typeof import("@swc/core") = require("@swc/core");
            transformFunc = (code, sourceFile, sourceMaps): string => {
                const preprocessedCode = shouldRemoveViteQueryImports ? removeViteQueryImports(code, sourceFile) : code;

                return transformSync(preprocessedCode, {
                    sourceFileName: sourceFile,
                    sourceMaps: sourceMaps ? "inline" : false,
                    configFile: false,
                    swcrc: false,
                    minify: false,
                    module: {
                        type: "commonjs",
                        ignoreDynamic: true,
                    },
                    jsc: {
                        target: "esnext",
                        parser: {
                            syntax: "typescript",
                            tsx: true,
                            decorators: true,
                            dynamicImport: true,
                        },
                    },
                }).code;
            };
        } else {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { transformSync }: typeof import("esbuild") = require("esbuild");
            transformFunc = (code, sourceFile, sourceMaps): string => {
                const preprocessedCode = shouldRemoveViteQueryImports ? removeViteQueryImports(code, sourceFile) : code;

                return transformSync(preprocessedCode, {
                    sourcefile: sourceFile,
                    sourcemap: sourceMaps ? "inline" : false,
                    minify: false,
                    loader: path.extname(sourceFile).includes("j") ? "jsx" : "tsx",
                    format: "cjs",
                    target: "esnext",
                    platform: "node",
                    jsx: "automatic",
                }).code;
            };
        }
    }

    return transformFunc(code, sourceFile, sourceMaps);
};

export const registerTransformHook = (isSilent: boolean = false): void => {
    const processWithTranspileSymbol = process as ProcessWithTransformHook;

    if (processWithTranspileSymbol[TESTPLANE_TRANSFORM_HOOK] || process.env.TS_ENABLE === "false") {
        return;
    }

    try {
        const mkTransformCodeHook =
            (sourceMaps = false): Parameters<typeof addHook>[0] =>
            (code, sourceFile) =>
                transformCode(code, { sourceFile, sourceMaps, isSilent });

        const transformCodeOptions: Parameters<typeof addHook>[1] = {
            exts: TRANSFORM_CODE_EXTENSIONS,
            ignoreNodeModules: true,
        };

        let areSourceMapsEnabled = false;

        let revertTransformHook = addHook(mkTransformCodeHook(), transformCodeOptions);

        const revertAssetHook = addHook(() => "module.exports = {};", {
            exts: ASSET_EXTENSIONS,
            ignoreNodeModules: false,
        });

        const enableSourceMaps = (): void => {
            if (areSourceMapsEnabled) {
                return;
            }

            areSourceMapsEnabled = true;

            revertTransformHook();

            revertTransformHook = addHook(mkTransformCodeHook(true), transformCodeOptions);
        };

        const revertAll = (): void => {
            revertTransformHook();
            revertAssetHook();
            delete processWithTranspileSymbol[TESTPLANE_TRANSFORM_HOOK];
        };

        processWithTranspileSymbol[TESTPLANE_TRANSFORM_HOOK] = { revert: revertAll, enableSourceMaps };
    } catch (err) {
        logger.warn(`testplane: an error occurred while trying to register transform hook.`, err);
    }
};

export const updateTransformHook = (config: CommonConfig): void => {
    shouldRemoveViteQueryImports = isRunInBrowserEnv(config);
};

export const enableSourceMaps = (): void => {
    const processWithTranspileSymbol = process as ProcessWithTransformHook;

    if (!processWithTranspileSymbol[TESTPLANE_TRANSFORM_HOOK]) {
        return;
    }

    processWithTranspileSymbol[TESTPLANE_TRANSFORM_HOOK].enableSourceMaps();
};

function removeViteQueryImports(code: string, sourceFile: string): string {
    const extname = path.extname(sourceFile);
    const isJsxOrTsx = extname === ".jsx" || extname === ".tsx";

    if (!isJsxOrTsx) {
        return code;
    }

    let parser: RecastParser | null = null;

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const babelParser: typeof import("@babel/parser") = require("@babel/parser");

        parser = {
            parse(source: string): ReturnType<typeof babelParser.parse> {
                return babelParser.parse(source, {
                    sourceType: "module",
                    plugins: [
                        "typescript",
                        "jsx",
                        "decorators-legacy",
                        "classProperties",
                        "nullishCoalescingOperator",
                        "optionalChaining",
                    ],
                    tokens: true,
                });
            },
        };
    } catch (err) {
        // If @babel/parser is not installed, return original code without transformation.
        // This is not a critical issue as the user may not be using Vite-style imports with query parameters.
        return code;
    }

    let ast: recast.types.namedTypes.File;

    try {
        ast = recast.parse(code, {
            parser,
            sourceFileName: sourceFile,
            sourceRoot: path.dirname(sourceFile),
        });
    } catch (err) {
        const errorMessage = (err as Error).message;
        logger.warn(
            `Failed to parse file ${sourceFile} for removal of Vite query imports: ${errorMessage}. ` +
                `The file will be processed without removing query imports.`,
        );
        return code;
    }

    recast.visit(ast, {
        visitImportDeclaration(nodePath) {
            const declaration = nodePath.value as recast.types.namedTypes.ImportDeclaration;
            const source = declaration.source.value;

            if (typeof source === "string") {
                const extname = path.extname(source);

                if (extname && extname.includes("?")) {
                    nodePath.prune();
                    return false;
                }
            }

            return this.traverse(nodePath);
        },
    });

    try {
        const result = recast.print(ast, { sourceMapName: sourceFile });
        return result.code;
    } catch (err) {
        const errorMessage = (err as Error).message;
        logger.warn(
            `Failed to transform AST for ${sourceFile} for removal of Vite query imports: ${errorMessage}. ` +
                `The file will be processed without removing query imports.`,
        );
        return code;
    }
}
