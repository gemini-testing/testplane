import path from "node:path";
import { addHook } from "pirates";
import * as logger from "./logger";

const TESTPLANE_TRANSFORM_HOOK = Symbol.for("testplane.transform.hook");

const TRANSFORM_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"];
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

let transformFunc: null | ((code: string, sourceFile: string, sourceMaps: boolean) => string) = null;

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
            transformFunc = (code, sourceFile, sourceMaps): string =>
                transformSync(code, {
                    sourceFileName: sourceFile,
                    sourceMaps: sourceMaps ? "inline" : false,
                    configFile: false,
                    swcrc: false,
                    minify: false,
                    module: {
                        type: "commonjs",
                    },
                    jsc: {
                        target: "esnext",
                        parser: {
                            syntax: "typescript",
                            tsx: true,
                        },
                    },
                }).code;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { transformSync }: typeof import("esbuild") = require("esbuild");
            transformFunc = (code, sourceFile, sourceMaps): string =>
                transformSync(code, {
                    sourcefile: sourceFile,
                    sourcemap: sourceMaps ? "inline" : false,
                    minify: false,
                    loader: path.extname(sourceFile).includes("j") ? "jsx" : "tsx",
                    format: "cjs",
                    target: "esnext",
                    jsx: "automatic",
                }).code;
        }
    }

    return transformFunc(code, sourceFile, sourceMaps);
};

export const registerTransformHook = (isSilent: boolean = false): void => {
    const processWithEsbuildSymbol = process as typeof process & {
        [TESTPLANE_TRANSFORM_HOOK]?: { revert: () => void };
    };

    if (processWithEsbuildSymbol[TESTPLANE_TRANSFORM_HOOK] || process.env.TS_ENABLE === "false") {
        return;
    }

    try {
        const revertTransformHook = addHook(
            (code, filename) => transformCode(code, { sourceFile: filename, sourceMaps: false, isSilent }),
            {
                exts: TRANSFORM_EXTENSIONS,
                matcher: filename => !filename.includes("node_modules"),
                ignoreNodeModules: false,
            },
        );

        const revertAssetHook = addHook(() => "module.exports = {};", {
            exts: ASSET_EXTENSIONS,
            ignoreNodeModules: false,
        });

        const revertAll = (): void => {
            revertTransformHook();
            revertAssetHook();
            delete processWithEsbuildSymbol[TESTPLANE_TRANSFORM_HOOK];
        };

        processWithEsbuildSymbol[TESTPLANE_TRANSFORM_HOOK] = { revert: revertAll };
    } catch (err) {
        logger.warn(`testplane: an error occurred while trying to register transform hook.`, err);
    }
};
