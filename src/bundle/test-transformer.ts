import * as nodePath from "node:path";
import * as babel from "@babel/core";
import { addHook } from "pirates";
import { TRANSFORM_EXTENSIONS, JS_EXTENSION_RE } from "./constants";
import { requireModuleSync } from "../utils/module";

import type { NodePath, PluginObj, TransformOptions } from "@babel/core";
import type { ImportDeclaration } from "@babel/types";

const STYLE_EXTESTION_RE = /\.(css|less|scss|sass|styl|stylus|pcss)$/;
const IGNORE_STYLE_ERRORS = ["Unexpected token"];

export const setupTransformHook = (opts: { removeNonJsImports?: boolean } = {}): VoidFunction => {
    const transformOptions: TransformOptions = {
        browserslistConfigFile: false,
        babelrc: false,
        configFile: false,
        compact: false,
        presets: [require("@babel/preset-typescript")],
        sourceMaps: "inline",
        plugins: [
            [
                require("@babel/plugin-transform-react-jsx"),
                {
                    throwIfNamespace: false,
                    runtime: "automatic",
                },
            ],
            require("@babel/plugin-transform-modules-commonjs"),
        ],
    };

    const customIgnoreImportsPlugin = (): PluginObj => ({
        name: "ignore-imports",
        visitor: {
            ImportDeclaration(path: NodePath<ImportDeclaration>): void {
                const extname = nodePath.extname(path.node.source.value);

                if (extname && !extname.match(JS_EXTENSION_RE)) {
                    path.remove();
                    return;
                }

                try {
                    requireModuleSync(path.node.source.value);
                } catch (err) {
                    if (shouldIgnoreImportError(err as Error)) {
                        path.remove();
                    }
                }
            },
        },
    });

    if (opts.removeNonJsImports) {
        transformOptions.plugins!.push([customIgnoreImportsPlugin]);
    }

    const revertTransformHook = addHook(
        (originalCode, filename) => {
            return babel.transform(originalCode, { filename, ...transformOptions })!.code as string;
        },
        { exts: TRANSFORM_EXTENSIONS },
    );

    return revertTransformHook;
};

function shouldIgnoreImportError(err: Error): boolean {
    const shouldIgnoreImport = IGNORE_STYLE_ERRORS.some(ignoreImportErr => {
        return (err as Error).message.startsWith(ignoreImportErr);
    });

    if (!shouldIgnoreImport) {
        return false;
    }

    const firstStackFrame = (err as Error).stack?.split("\n")[0] || "";
    const filePath = firstStackFrame.split(":")[0];
    const isStyleFilePath = STYLE_EXTESTION_RE.test(filePath);

    return isStyleFilePath;
}
