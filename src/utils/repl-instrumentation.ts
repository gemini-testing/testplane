import path from "node:path";
import debug from "debug";
import * as recast from "recast";
import RuntimeConfig from "../config/runtime-config";
import { REPL_SCOPED_EVAL_CONTEXT_KEY, REPL_SCOPED_FN_FLAG } from "../constants/repl";
import * as logger from "./logger";

const debugReplInstrumentation = debug("testplane:repl-instrumentation");

type RecastParser = {
    parse(source: string, options?: unknown): unknown;
};

type StatementKind = Parameters<typeof recast.types.builders.blockStatement>[0][number];
type TestCallbackParam = recast.types.namedTypes.FunctionExpression["params"][number];
interface BindingPatternNode {
    type: string;
    name?: string;
    properties?: Array<{
        type: string;
        value?: BindingPatternNode;
        argument?: BindingPatternNode;
    }>;
    elements?: Array<BindingPatternNode | null>;
    left?: BindingPatternNode;
    argument?: BindingPatternNode;
    value?: BindingPatternNode;
}

export function instrumentReplBeforeTestIfNeeded(code: string, sourceFile: string): string {
    if (!RuntimeConfig.getInstance()?.replMode?.beforeTest) {
        return code;
    }

    return instrumentReplBeforeTest(code, sourceFile);
}

function instrumentReplBeforeTest(code: string, sourceFile: string): string {
    const parser = mkBabelParser();

    if (!parser) {
        debugReplInstrumentation("skip %s: @babel/parser is not available", sourceFile);
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
        logger.warn(`Failed to parse file ${sourceFile} for REPL instrumentation: ${(err as Error).message}.`);
        return code;
    }

    let isChanged = false;
    let testDefinitionCount = 0;
    let instrumentedCallbackCount = 0;

    recast.visit(ast, {
        visitCallExpression(nodePath) {
            const node = nodePath.value as recast.types.namedTypes.CallExpression;

            // Handles it(...), specify(...), it.only(...), and it.skip(...).
            if (!isTestDefinitionCall(node)) {
                return this.traverse(nodePath);
            }

            testDefinitionCount++;

            // Handles it("title", fn) and it("title", { tag }, fn).
            const fnIndex = node.arguments.findIndex(isTestCallback);

            if (fnIndex === -1) {
                return this.traverse(nodePath);
            }

            const callback = node.arguments[fnIndex] as
                | recast.types.namedTypes.FunctionExpression
                | recast.types.namedTypes.ArrowFunctionExpression;

            instrumentTestCallback(callback);
            node.arguments[fnIndex] = markTestCallback(callback);
            isChanged = true;
            instrumentedCallbackCount++;

            return this.traverse(nodePath);
        },
    });

    if (!isChanged) {
        debugReplInstrumentation(
            "skip %s: no instrumentable test callbacks found, test definitions: %d",
            sourceFile,
            testDefinitionCount,
        );
        return code;
    }

    try {
        const result = recast.print(ast, { sourceMapName: sourceFile }).code;

        debugReplInstrumentation(
            "instrumented %s: %d callback(s), test definitions: %d",
            sourceFile,
            instrumentedCallbackCount,
            testDefinitionCount,
        );

        return result;
    } catch (err) {
        logger.warn(`Failed to print file ${sourceFile} after REPL instrumentation: ${(err as Error).message}.`);
        return code;
    }
}

function mkBabelParser(): RecastParser | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const babelParser: typeof import("@babel/parser") = require("@babel/parser");

        return {
            parse(source: string): ReturnType<typeof babelParser.parse> {
                return babelParser.parse(source, {
                    // Parses both import-based specs and legacy CommonJS-style specs.
                    sourceType: "unambiguous",
                    plugins: [
                        "typescript",
                        "jsx",
                        "decorators-legacy",
                        "classProperties",
                        "nullishCoalescingOperator",
                        "optionalChaining",
                        "topLevelAwait",
                    ],
                    tokens: true,
                });
            },
        };
    } catch {
        return null;
    }
}

function isTestDefinitionCall(node: recast.types.namedTypes.CallExpression): boolean {
    const callee = node.callee;

    if (callee.type === "Identifier") {
        return ["it", "specify"].includes(callee.name);
    }

    if (callee.type !== "MemberExpression" || callee.computed) {
        return false;
    }

    const property = callee.property;

    if (property.type !== "Identifier" || !["only", "skip"].includes(property.name)) {
        return false;
    }

    const object = callee.object;

    return object.type === "Identifier" && ["it", "specify"].includes(object.name);
}

function isTestCallback(
    node: recast.types.namedTypes.CallExpression["arguments"][number],
): node is recast.types.namedTypes.FunctionExpression | recast.types.namedTypes.ArrowFunctionExpression {
    return node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression";
}

function instrumentTestCallback(
    callback: recast.types.namedTypes.FunctionExpression | recast.types.namedTypes.ArrowFunctionExpression,
): void {
    // Handles it("test", () => value) by converting it to async () => { await repl; return value; }.
    callback.async = true;

    const replStatements = parseStatements(mkScopedReplStatement(getBrowserExpression(callback)));

    if (callback.body.type === "BlockStatement") {
        (callback.body.body as StatementKind[]).unshift(...replStatements);
        return;
    }

    const originalExpression = callback.body;
    const returnStatement = recast.types.builders.returnStatement(originalExpression);

    callback.body = recast.types.builders.blockStatement([...replStatements, returnStatement]);
}

function markTestCallback(
    callback: recast.types.namedTypes.FunctionExpression | recast.types.namedTypes.ArrowFunctionExpression,
): recast.types.namedTypes.CallExpression {
    // Marks Object.assign(async function() {}, { "__testplaneScopedRepl": true }) to skip the old runner REPL.
    return parseExpression(
        `Object.assign(${recast.print(callback).code}, { ${JSON.stringify(REPL_SCOPED_FN_FLAG)}: true })`,
    ) as recast.types.namedTypes.CallExpression;
}

function getBrowserExpression(
    callback: recast.types.namedTypes.FunctionExpression | recast.types.namedTypes.ArrowFunctionExpression,
): string {
    const [firstParam] = callback.params;
    const browserFromParam = getBrowserExpressionFromParam(firstParam);

    if (browserFromParam) {
        return browserFromParam;
    }

    const browserFromScope = hasTopLevelBinding(callback, "browser")
        ? "globalThis.browser"
        : '(typeof browser !== "undefined" && browser) || globalThis.browser';

    // Handles it("test", function() { const { browser } = this; }) without reading browser before const init.
    if (callback.type === "FunctionExpression") {
        return `(this && this.browser) || arguments[0]?.browser || ${browserFromScope}`;
    }

    return browserFromScope;
}

function getBrowserExpressionFromParam(param?: TestCallbackParam): string | null {
    if (!param) {
        return null;
    }

    // Handles it("test", async browser => ...).
    if (isIdentifier(param)) {
        return `${param.name}.browser`;
    }

    if (!isObjectPattern(param)) {
        return null;
    }

    for (const property of param.properties) {
        if (property.type !== "Property" || property.computed) {
            continue;
        }

        const key = property.key;

        if (key.type !== "Identifier" || key.name !== "browser") {
            continue;
        }

        const value = property.value;

        // Handles it("test", async ({ browser }) => ...).
        if (value.type === "Identifier") {
            return value.name;
        }
    }

    return null;
}

function isIdentifier(node: TestCallbackParam): node is recast.types.namedTypes.Identifier {
    return node.type === "Identifier";
}

function isObjectPattern(node: TestCallbackParam): node is recast.types.namedTypes.ObjectPattern {
    return node.type === "ObjectPattern";
}

function hasTopLevelBinding(
    callback: recast.types.namedTypes.FunctionExpression | recast.types.namedTypes.ArrowFunctionExpression,
    name: string,
): boolean {
    if (callback.body.type !== "BlockStatement") {
        return false;
    }

    return callback.body.body.some(statement => {
        // Handles const { browser } = this and const browser = ...
        if (statement.type === "VariableDeclaration") {
            const declaration = statement as recast.types.namedTypes.VariableDeclaration;

            return declaration.declarations.some(declarator => {
                const variableDeclarator = declarator as recast.types.namedTypes.VariableDeclarator;

                return bindingPatternHasName(variableDeclarator.id as unknown as BindingPatternNode, name);
            });
        }

        // Handles function browser() {} and class browser {}
        if (statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") {
            const declaration = statement as
                | recast.types.namedTypes.FunctionDeclaration
                | recast.types.namedTypes.ClassDeclaration;

            return declaration.id?.name === name;
        }

        return false;
    });
}

function bindingPatternHasName(node: BindingPatternNode | null | undefined, name: string): boolean {
    if (!node) {
        return false;
    }

    if (node.type === "Identifier") {
        return node.name === name;
    }

    if (node.type === "ObjectPattern") {
        return (
            node.properties?.some(property => {
                // Handles const { browser } = this and Babel's ObjectProperty variant.
                if (property.type === "Property" || property.type === "ObjectProperty") {
                    return bindingPatternHasName(property.value, name);
                }

                // Handles const { ...browser } = this.
                if (property.type === "RestElement" || property.type === "RestProperty") {
                    return bindingPatternHasName(property.argument, name);
                }

                return false;
            }) ?? false
        );
    }

    if (node.type === "ArrayPattern") {
        // Handles const [browser] = browsers.
        return node.elements?.some(element => element && bindingPatternHasName(element, name)) ?? false;
    }

    // Handles const { browser = fallback } = this.
    if (node.type === "AssignmentPattern") {
        return bindingPatternHasName(node.left, name);
    }

    if (node.type === "RestElement") {
        // Handles const [...browser] = browsers.
        return bindingPatternHasName(node.argument, name);
    }

    return false;
}

function mkScopedReplStatement(browserExpression: string): string {
    // Injects await browser.switchToRepl({ scoped eval }) as the first test-body statement.
    return `
        const __testplaneReplBrowser = ${browserExpression};

        if (!__testplaneReplBrowser || typeof __testplaneReplBrowser.switchToRepl !== "function") {
            throw new Error("Unable to enter REPL before test: browser is not available in the test scope");
        }

        await __testplaneReplBrowser.switchToRepl({
            ${JSON.stringify(REPL_SCOPED_EVAL_CONTEXT_KEY)}: async code => {
                try {
                    // First parse REPL input as an expression: SOMETHING or await browser.url(...).
                    return await eval("(async () => (" + code + "\\n))()");
                } catch (__testplaneReplError) {
                    if (!__testplaneReplError || __testplaneReplError.name !== "SyntaxError") {
                        throw __testplaneReplError;
                    }

                    // Fall back to statement input: const x = 1; await browser.url(...).
                    return await eval("(async () => { " + code + "\\n})()");
                }
            },
        });
    `;
}

function parseStatements(source: string): StatementKind[] {
    const ast = recast.parse(source, { parser: mkBabelParser()! }) as recast.types.namedTypes.File;

    return ast.program.body as StatementKind[];
}

function parseStatement(source: string): StatementKind {
    return parseStatements(source)[0];
}

function parseExpression(source: string): recast.types.namedTypes.Expression {
    const statement = parseStatement(source);

    if (statement.type !== "ExpressionStatement") {
        throw new Error("Expected expression statement");
    }

    return (statement as recast.types.namedTypes.ExpressionStatement).expression;
}
