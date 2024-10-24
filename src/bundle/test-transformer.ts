import * as nodePath from "node:path";
import * as babel from "@babel/core";
import { addHook } from "pirates";
import { TRANSFORM_EXTENSIONS, JS_EXTENSION_RE } from "./constants";
import { requireModuleSync } from "../utils/module";

import type { NodePath, PluginObj, TransformOptions } from "@babel/core";

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

    const customIgnoreImportsPlugin = ({ types: t }: { types: typeof babel.types }): PluginObj => ({
        name: "ignore-imports",
        visitor: {
            ImportDeclaration(path: NodePath<babel.types.ImportDeclaration>): void {
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
                        return;
                    }

                    if ((err as NodeJS.ErrnoException).code === "ERR_REQUIRE_ESM") {
                        mockEsmModuleImport(t, path);
                        return;
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

/**
 * Replace esm module import with a Proxy.
 * Examples:
 * 1) `import pkg from "package"` -> `const pkg = new Proxy({}, {get: ..., apply: ...})`
 * 2) `import {a, b as c} from "package"` -> `const {a, c} = new Proxy({}, {get: ..., apply: ...})`
 */
function mockEsmModuleImport(t: typeof babel.types, path: NodePath<babel.types.ImportDeclaration>): void {
    const variableKey = genVarDeclKey(t, path.node);
    const variableValue = genProxy(t, [
        t.objectExpression([]),
        t.objectExpression([genProxyGetHandler(t), genProxyApplyHandler(t)]),
    ]);

    const variableDecl = t.variableDeclaration("const", [t.variableDeclarator(variableKey, variableValue)]);

    path.replaceWith(variableDecl);
}

/**
 * Generates the name of variables from the import declaration.
 * Examples:
 * 1) `import pkg from "package"` -> `pkg`
 * 2) `import {a, b as c} from "package"` -> `const {a, с} `
 */
function genVarDeclKey(
    t: typeof babel.types,
    node: NodePath<babel.types.ImportDeclaration>["node"],
): babel.types.Identifier | babel.types.ObjectPattern {
    if (node.specifiers.length === 1) {
        if (["ImportDefaultSpecifier", "ImportNamespaceSpecifier"].includes(node.specifiers[0].type)) {
            return t.identifier(node.specifiers[0].local.name);
        }

        return t.objectPattern([
            t.objectProperty(
                t.identifier(node.specifiers[0].local.name),
                t.identifier(node.specifiers[0].local.name),
                false,
                true,
            ),
        ]);
    }

    const objectProperties = node.specifiers.map(spec => {
        return t.objectProperty(t.identifier(spec.local.name), t.identifier(spec.local.name), false, true);
    });

    return t.objectPattern(objectProperties);
}

// Generates Proxy expression with passed arguments: `new Proxy(args)`
function genProxy(t: typeof babel.types, args: babel.types.Expression[]): babel.types.NewExpression {
    return t.newExpression(t.identifier("Proxy"), args);
}

/**
 * Generates "get" handler for Proxy:
 *
 * get: function (target, prop) {
 *   return prop in target ? target[prop] : new Proxy(() => {}, this);
 * }
 */
function genProxyGetHandler(t: typeof babel.types): babel.types.ObjectProperty {
    return t.objectProperty(
        t.identifier("get"),
        t.functionExpression(
            null,
            [t.identifier("target"), t.identifier("prop")],
            t.blockStatement([
                t.returnStatement(
                    t.conditionalExpression(
                        t.binaryExpression("in", t.identifier("prop"), t.identifier("target")),
                        t.memberExpression(t.identifier("target"), t.identifier("prop"), true),
                        genProxy(t, [t.arrowFunctionExpression([], t.blockStatement([])), t.thisExpression()]),
                    ),
                ),
            ]),
        ),
    );
}

/**
 * Generates "apply" handler for Proxy:
 *
 * apply: function () {
 *   return new Proxy(() => {}, this);
 * }
 */
function genProxyApplyHandler(t: typeof babel.types): babel.types.ObjectProperty {
    return t.objectProperty(
        t.identifier("apply"),
        t.functionExpression(
            null,
            [],
            t.blockStatement([
                t.returnStatement(
                    genProxy(t, [t.arrowFunctionExpression([], t.blockStatement([])), t.thisExpression()]),
                ),
            ]),
        ),
    );
}
