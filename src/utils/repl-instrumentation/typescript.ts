import path from "node:path";
import { REPL_INSTRUMENTED_FN_FLAG_KEY } from "../../constants/repl";

import type * as TypeScript from "typescript";

type TypeScriptModule = typeof TypeScript;

interface InstrumentationOptions {
    beforeTest: boolean;
}

interface ProgramContext {
    checker: TypeScript.TypeChecker;
    sourceFile: TypeScript.SourceFile;
}

export const instrumentWithTypeScript = (
    ts: TypeScriptModule,
    code: string,
    sourceFileName: string,
    options: InstrumentationOptions,
): string => {
    const programContext = createProgramContext(ts, code, sourceFileName);

    if (!programContext) {
        return code;
    }

    let changed = false;
    const transformer: TypeScript.TransformerFactory<TypeScript.SourceFile> = transformContext => {
        const visit: TypeScript.Visitor = node => {
            if (ts.isCallExpression(node)) {
                const testCall = options.beforeTest
                    ? instrumentTestCall(ts, programContext, transformContext, visit, node)
                    : null;

                if (testCall) {
                    changed = true;
                    return testCall;
                }

                const switchToReplCall = instrumentSwitchToReplCall(ts, programContext, transformContext, visit, node);

                if (switchToReplCall) {
                    changed = true;
                    return switchToReplCall;
                }
            }

            return ts.visitEachChild(node, visit, transformContext);
        };

        return sourceFile => ts.visitNode(sourceFile, visit) as TypeScript.SourceFile;
    };

    const result = ts.transform(programContext.sourceFile, [transformer]);

    try {
        if (!changed) {
            return code;
        }

        const printer = ts.createPrinter();

        return printer.printFile(result.transformed[0]);
    } finally {
        result.dispose();
    }
};

function createProgramContext(ts: TypeScriptModule, code: string, sourceFileName: string): ProgramContext | null {
    const normalizedSourceFileName = path.resolve(sourceFileName);
    const compilerOptions: TypeScript.CompilerOptions = {
        allowJs: true,
        allowNonTsExtensions: true,
        checkJs: false,
        module: ts.ModuleKind.CommonJS,
        noResolve: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ESNext,
    };
    const host = ts.createCompilerHost(compilerOptions, true);
    const scriptKind = getScriptKind(ts, normalizedSourceFileName);
    const sourceFile = ts.createSourceFile(normalizedSourceFileName, code, ts.ScriptTarget.ESNext, true, scriptKind);
    const isTargetFile = (fileName: string): boolean => path.resolve(fileName) === normalizedSourceFileName;

    host.getSourceFile = (fileName): TypeScript.SourceFile | undefined => {
        return isTargetFile(fileName) ? sourceFile : undefined;
    };
    host.fileExists = isTargetFile;
    host.readFile = (fileName): string | undefined => (isTargetFile(fileName) ? code : undefined);

    const program = ts.createProgram([normalizedSourceFileName], compilerOptions, host);
    const programSourceFile = program.getSourceFile(normalizedSourceFileName);

    if (!programSourceFile) {
        return null;
    }

    return {
        checker: program.getTypeChecker(),
        sourceFile: programSourceFile,
    };
}

function getScriptKind(ts: TypeScriptModule, sourceFileName: string): TypeScript.ScriptKind {
    switch (path.extname(sourceFileName)) {
        case ".ts":
        case ".mts":
        case ".cts":
            return ts.ScriptKind.TS;
        case ".tsx":
            return ts.ScriptKind.TSX;
        case ".jsx":
            return ts.ScriptKind.JSX;
        default:
            return ts.ScriptKind.JS;
    }
}

function instrumentSwitchToReplCall(
    ts: TypeScriptModule,
    programContext: ProgramContext,
    transformContext: TypeScript.TransformationContext,
    visit: TypeScript.Visitor,
    node: TypeScript.CallExpression,
): TypeScript.CallExpression | null {
    if (!isSwitchToReplCall(ts, node)) {
        return null;
    }

    const visitedNode = ts.visitEachChild(node, visit, transformContext);
    const replContext = createReplContextObject(ts, programContext, node, node.getStart(programContext.sourceFile));

    // browser.switchToRepl(userCtx) -> browser.switchToRepl(userCtx, generatedLexicalCtx)
    if (!replContext) {
        return null;
    }

    return ts.factory.updateCallExpression(visitedNode, visitedNode.expression, visitedNode.typeArguments, [
        ...visitedNode.arguments,
        replContext,
    ]);
}

function instrumentTestCall(
    ts: TypeScriptModule,
    programContext: ProgramContext,
    transformContext: TypeScript.TransformationContext,
    visit: TypeScript.Visitor,
    node: TypeScript.CallExpression,
): TypeScript.CallExpression | null {
    const callbackIndex = getTestCallbackIndex(ts, node);

    if (callbackIndex === null) {
        return null;
    }

    const callback = node.arguments[callbackIndex] as TypeScript.ArrowFunction | TypeScript.FunctionExpression;
    const browserExpression = getBrowserExpression(ts, callback);

    if (!browserExpression) {
        return null;
    }

    const visitedCallback = ts.visitEachChild(callback, visit, transformContext) as
        | TypeScript.ArrowFunction
        | TypeScript.FunctionExpression;
    const replContext = createReplContextObject(
        ts,
        programContext,
        callback.body,
        callback.body.getStart(programContext.sourceFile),
    );
    const injectedCallback = injectBeforeTestReplCall(ts, visitedCallback, browserExpression, replContext);
    const markedCallback = markCallbackAsInstrumented(ts, injectedCallback);
    const args = [...node.arguments];

    args[callbackIndex] = markedCallback;

    return ts.factory.updateCallExpression(node, node.expression, node.typeArguments, args);
}

function isSwitchToReplCall(ts: TypeScriptModule, node: TypeScript.CallExpression): boolean {
    return ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "switchToRepl";
}

function getTestCallbackIndex(ts: TypeScriptModule, node: TypeScript.CallExpression): number | null {
    if (!isTestCall(ts, node.expression)) {
        return null;
    }

    for (let i = node.arguments.length - 1; i >= 0; i--) {
        const arg = node.arguments[i];

        if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
            return i;
        }
    }

    return null;
}

function isTestCall(ts: TypeScriptModule, expression: TypeScript.Expression): boolean {
    if (ts.isIdentifier(expression)) {
        return expression.text === "it";
    }

    return ts.isPropertyAccessExpression(expression) && isTestCall(ts, expression.expression);
}

function getBrowserExpression(
    ts: TypeScriptModule,
    callback: TypeScript.ArrowFunction | TypeScript.FunctionExpression,
): TypeScript.Expression | null {
    for (const param of callback.parameters) {
        if (ts.isIdentifier(param.name)) {
            return ts.factory.createPropertyAccessExpression(param.name, "browser");
        }

        if (ts.isObjectBindingPattern(param.name)) {
            const browserName = getBrowserBindingName(ts, param.name);

            if (browserName) {
                return browserName;
            }
        }
    }

    return ts.isFunctionExpression(callback)
        ? ts.factory.createPropertyAccessExpression(ts.factory.createThis(), "browser")
        : null;
}

function getBrowserBindingName(
    ts: TypeScriptModule,
    bindingPattern: TypeScript.ObjectBindingPattern,
): TypeScript.Identifier | null {
    for (const element of bindingPattern.elements) {
        const propertyName = element.propertyName;
        const isBrowserProperty =
            (propertyName && ts.isIdentifier(propertyName) && propertyName.text === "browser") ||
            (!propertyName && ts.isIdentifier(element.name) && element.name.text === "browser");

        if (isBrowserProperty && ts.isIdentifier(element.name)) {
            return element.name;
        }
    }

    return null;
}

function injectBeforeTestReplCall(
    ts: TypeScriptModule,
    callback: TypeScript.ArrowFunction | TypeScript.FunctionExpression,
    browserExpression: TypeScript.Expression,
    replContext: TypeScript.ObjectLiteralExpression | null,
): TypeScript.ArrowFunction | TypeScript.FunctionExpression {
    // it("x", async ({ browser }) => { body }) -> it("x", async ({ browser }) => { await browser.switchToRepl(replContext); body })
    const switchToReplArgs: TypeScript.Expression[] = replContext ? [replContext] : [];
    const switchToRepl = ts.factory.createAwaitExpression(
        ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(browserExpression, "switchToRepl"),
            undefined,
            switchToReplArgs,
        ),
    );
    const injectedStatement = ts.factory.createExpressionStatement(switchToRepl);
    const body = ts.isBlock(callback.body)
        ? ts.factory.updateBlock(callback.body, [injectedStatement, ...callback.body.statements])
        : ts.factory.createBlock([injectedStatement, ts.factory.createReturnStatement(callback.body)], true);
    const modifiers = ensureAsyncModifier(ts, callback.modifiers);

    return ts.isArrowFunction(callback)
        ? ts.factory.updateArrowFunction(
              callback,
              modifiers,
              callback.typeParameters,
              callback.parameters,
              callback.type,
              callback.equalsGreaterThanToken,
              body,
          )
        : ts.factory.updateFunctionExpression(
              callback,
              modifiers,
              callback.asteriskToken,
              callback.name,
              callback.typeParameters,
              callback.parameters,
              callback.type,
              body,
          );
}

function ensureAsyncModifier(
    ts: TypeScriptModule,
    modifiers: TypeScript.NodeArray<TypeScript.ModifierLike> | undefined,
): TypeScript.NodeArray<TypeScript.Modifier> {
    const existingModifiers = (modifiers || []).filter(
        modifier => modifier.kind !== ts.SyntaxKind.Decorator,
    ) as TypeScript.Modifier[];

    if (existingModifiers.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
        return ts.factory.createNodeArray(existingModifiers);
    }

    return ts.factory.createNodeArray([ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword), ...existingModifiers]);
}

function markCallbackAsInstrumented(
    ts: TypeScriptModule,
    callback: TypeScript.ArrowFunction | TypeScript.FunctionExpression,
): TypeScript.CallExpression {
    // The runner checks this symbol to avoid opening a second before-test REPL.
    // Roughly, converts it("x", async ({ browser }) => { body }) to it("x", Object.assign(async ({ browser }) => { body }, { [Symbol.for("...")]: true }));
    return ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("Object"), "assign"),
        undefined,
        [
            callback,
            ts.factory.createObjectLiteralExpression([
                ts.factory.createPropertyAssignment(
                    ts.factory.createComputedPropertyName(
                        ts.factory.createCallExpression(
                            ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("Symbol"), "for"),
                            undefined,
                            [ts.factory.createStringLiteral(REPL_INSTRUMENTED_FN_FLAG_KEY)],
                        ),
                    ),
                    ts.factory.createTrue(),
                ),
            ]),
        ],
    );
}

function createReplContextObject(
    ts: TypeScriptModule,
    { checker, sourceFile }: ProgramContext,
    node: TypeScript.Node,
    position: number,
): TypeScript.ObjectLiteralExpression | null {
    const symbols = checker.getSymbolsInScope(node, ts.SymbolFlags.Value);
    const accessors: TypeScript.ObjectLiteralElementLike[] = [];
    const seenNames = new Set<string>();
    const addAccessor = (name: string, canWrite: boolean): void => {
        if (seenNames.has(name) || name.startsWith("__testplane")) {
            return;
        }

        seenNames.add(name);
        accessors.push(createGetter(ts, name));

        if (canWrite) {
            accessors.push(createSetter(ts, name));
        }
    };

    // Import bindings are alias symbols, so getSymbolsInScope(...Value) does not cover them
    for (const name of collectImportBindingNames(ts, sourceFile)) {
        addAccessor(name, false);
    }

    for (const symbol of symbols) {
        const name = symbol.getName();

        if (!shouldExposeSymbol(sourceFile, symbol, name, position)) {
            continue;
        }

        addAccessor(name, canWriteSymbol(ts, sourceFile, symbol));
    }

    return accessors.length > 0 ? ts.factory.createObjectLiteralExpression(accessors, true) : null;
}

function collectImportBindingNames(ts: TypeScriptModule, sourceFile: TypeScript.SourceFile): string[] {
    const names: string[] = [];

    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
            names.push(...collectImportDeclarationBindingNames(ts, statement));
            continue;
        }

        if (ts.isImportEqualsDeclaration(statement) && !statement.isTypeOnly) {
            names.push(statement.name.text);
        }
    }

    return names;
}

function collectImportDeclarationBindingNames(
    ts: TypeScriptModule,
    declaration: TypeScript.ImportDeclaration,
): string[] {
    const importClause = declaration.importClause;
    const names: string[] = [];

    if (!importClause || importClause.isTypeOnly) {
        return names;
    }

    if (importClause.name) {
        names.push(importClause.name.text);
    }

    if (!importClause.namedBindings) {
        return names;
    }

    if (ts.isNamespaceImport(importClause.namedBindings)) {
        names.push(importClause.namedBindings.name.text);
        return names;
    }

    for (const element of importClause.namedBindings.elements) {
        if (!element.isTypeOnly) {
            names.push(element.name.text);
        }
    }

    return names;
}

function shouldExposeSymbol(
    sourceFile: TypeScript.SourceFile,
    symbol: TypeScript.Symbol,
    name: string,
    position: number,
): boolean {
    if (name === "arguments") {
        return false;
    }

    return (symbol.getDeclarations() || []).some(declaration => {
        return declaration.getSourceFile() === sourceFile && declaration.getStart(sourceFile) <= position;
    });
}

function canWriteSymbol(ts: TypeScriptModule, sourceFile: TypeScript.SourceFile, symbol: TypeScript.Symbol): boolean {
    return (symbol.getDeclarations() || []).some(declaration => {
        const variableDeclaration = findVariableDeclaration(ts, declaration);

        return (
            variableDeclaration?.getSourceFile() === sourceFile &&
            isWritableVariableDeclaration(ts, variableDeclaration)
        );
    });
}

function isWritableVariableDeclaration(ts: TypeScriptModule, declaration: TypeScript.VariableDeclaration): boolean {
    const declarationList = declaration.parent;

    // eslint-disable-next-line no-bitwise
    return ts.isVariableDeclarationList(declarationList) && (declarationList.flags & ts.NodeFlags.Const) === 0;
}

function findVariableDeclaration(ts: TypeScriptModule, node: TypeScript.Node): TypeScript.VariableDeclaration | null {
    let current: TypeScript.Node | undefined = node;

    while (current) {
        if (ts.isVariableDeclaration(current)) {
            return current;
        }

        current = current.parent;
    }

    return null;
}

function createGetter(ts: TypeScriptModule, name: string): TypeScript.GetAccessorDeclaration {
    // get localValue() { return localValue; } keeps REPL reads linked to the lexical binding.
    return ts.factory.createGetAccessorDeclaration(
        undefined,
        name,
        [],
        undefined,
        ts.factory.createBlock([ts.factory.createReturnStatement(ts.factory.createIdentifier(name))], true),
    );
}

function createSetter(ts: TypeScriptModule, name: string): TypeScript.SetAccessorDeclaration {
    const value = ts.factory.createIdentifier("__testplaneReplValue");

    // set localValue(v) { localValue = v; } lets REPL writes update writable lexical bindings.
    return ts.factory.createSetAccessorDeclaration(
        undefined,
        name,
        [ts.factory.createParameterDeclaration(undefined, undefined, value)],
        ts.factory.createBlock(
            [
                ts.factory.createExpressionStatement(
                    ts.factory.createAssignment(ts.factory.createIdentifier(name), value),
                ),
            ],
            true,
        ),
    );
}
