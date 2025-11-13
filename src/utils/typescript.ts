import path from "node:path";
import { addHook } from "pirates";
import * as logger from "./logger";

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

type ProcessWithTransformHook = typeof process & {
    [TESTPLANE_TRANSFORM_HOOK]?: { revert: () => void; enableSourceMaps: () => void };
};

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
                            decorators: true,
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

export const enableSourceMaps = (): void => {
    const processWithTranspileSymbol = process as ProcessWithTransformHook;

    if (!processWithTranspileSymbol[TESTPLANE_TRANSFORM_HOOK]) {
        return;
    }

    processWithTranspileSymbol[TESTPLANE_TRANSFORM_HOOK].enableSourceMaps();
};
