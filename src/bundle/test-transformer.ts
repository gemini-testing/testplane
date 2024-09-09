import * as nodePath from "node:path";
import * as babel from "@babel/core";
import { addHook } from "pirates";
import { TRANSFORM_EXTENSIONS, JS_EXTENSION_RE } from "./constants";

import type { NodePath, PluginObj, TransformOptions } from "@babel/core";
import type { ImportDeclaration } from "@babel/types";

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
