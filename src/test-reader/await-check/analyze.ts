import ts from "typescript";
import { createCommandCatalog, elementCommands, elementsCommands, syncCommands } from "./commands";
import { createSourceProgram, isArrayType, isPromiseType, returnsPromise, returnsPromiseArray } from "./type-info";
import { allPromises, clone, consume, merge, value } from "./flow";
import type { Binding, Exit, Flow, FunctionNode, State, Value, ValueKind } from "./flow";
import type { AnalyzeOptions, MissingAwaitDiagnostic } from "./types";

interface Frame {
    thisValue: Value;
    root: boolean;
}

interface FunctionResult {
    promise: boolean;
    returned: Value;
    pending: Set<ts.CallExpression>;
    consumed: Set<ts.CallExpression>;
}

const isFunction = (node: ts.Node): node is FunctionNode =>
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node);

const isAsync = (node: FunctionNode): boolean =>
    Boolean(node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword));

function member(node: ts.Expression): { object: ts.Expression; name: string } | undefined {
    if (ts.isPropertyAccessExpression(node)) return { object: node.expression, name: node.name.text };
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
        return { object: node.expression, name: node.argumentExpression.text };
    }
    return undefined;
}

function unwrap(node: ts.Expression): ts.Expression {
    while (
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isTypeAssertionExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isSatisfiesExpression(node)
    )
        node = node.expression;
    return node;
}

function joinedValue(values: Value[]): Value {
    if (!values.length) return value();
    return {
        kind: values.every(v => v.kind === values[0].kind) ? values[0].kind : "unknown",
        promises: new Set(values.flatMap(v => [...v.promises])),
        items: values.some(v => v.items) ? values.flatMap(v => v.items ?? []) : undefined,
    };
}

const settled = (v: Value): Value => ({ ...v, promises: new Set() });

class Analyzer {
    private readonly checker: ts.TypeChecker;
    private readonly source: ts.SourceFile;
    private readonly catalog = createCommandCatalog();
    private readonly diagnostics = new Map<ts.Node, MissingAwaitDiagnostic>();
    private readonly visiting = new Set<FunctionNode>();
    private readonly labels = new Map<ts.CallExpression, string>();

    constructor(
        private readonly options: AnalyzeOptions,
        private readonly program: ts.Program,
    ) {
        this.checker = program.getTypeChecker();
        this.source = program.getSourceFile(options.file)!;
    }

    run(): MissingAwaitDiagnostic[] {
        const error = this.program.getSyntacticDiagnostics(this.source)[0];
        if (error) {
            const location = this.source.getLineAndCharacterOfPosition(error.start ?? 0);
            throw Object.assign(new SyntaxError(ts.flattenDiagnosticMessageText(error.messageText, "\n")), {
                line: location.line + 1,
                column: location.character + 1,
            });
        }
        const visit = (node: ts.Node): void => {
            if (ts.isCallExpression(node) && this.dslName(node.expression)) {
                const fn = node.arguments.find(
                    (arg): arg is ts.ArrowFunction | ts.FunctionExpression =>
                        ts.isArrowFunction(arg) || ts.isFunctionExpression(arg),
                );
                if (fn) {
                    this.analyzeFunction(fn, { bindings: new Map(), pending: new Set() }, [], {
                        root: true,
                        thisValue: ts.isArrowFunction(fn) ? value() : value("context"),
                    });
                    return;
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(this.source);
        return [...this.diagnostics.values()].sort((a, b) => a.line - b.line || a.column - b.column);
    }

    private binding(node: ts.Identifier): Binding {
        const symbol = ts.isShorthandPropertyAssignment(node.parent)
            ? this.checker.getShorthandAssignmentValueSymbol(node.parent)
            : this.checker.getSymbolAtLocation(node);
        return symbol ?? node.text;
    }

    private dslName(expression: ts.Expression): string | undefined {
        const node = unwrap(expression);
        const prop = member(node);
        if (prop && ["only", "skip"].includes(prop.name)) return this.dslName(prop.object);
        const allowed =
            this.options.mochaUi === "tdd"
                ? ["test", "setup", "teardown"]
                : this.options.mochaUi === "qunit"
                  ? ["test", "beforeEach", "afterEach"]
                  : ["it", "specify", "beforeEach", "afterEach"];
        if (!ts.isIdentifier(node)) return undefined;
        const symbol = this.checker.getSymbolAtLocation(node);
        const declaration = symbol?.declarations?.[0];
        let name = node.text;
        if (declaration && !declaration.getSourceFile().isDeclarationFile) {
            if (ts.isImportSpecifier(declaration)) {
                const mod = declaration.parent.parent.parent.moduleSpecifier;
                if (!ts.isStringLiteral(mod) || !["mocha", "testplane", "hermione"].includes(mod.text))
                    return undefined;
                name = (declaration.propertyName ?? declaration.name).text;
            } else if (ts.isBindingElement(declaration) && ts.isVariableDeclaration(declaration.parent.parent)) {
                const init = declaration.parent.parent.initializer;
                if (
                    !init ||
                    !ts.isCallExpression(init) ||
                    !ts.isIdentifier(init.expression) ||
                    init.expression.text !== "require" ||
                    !init.arguments[0] ||
                    !ts.isStringLiteral(init.arguments[0]) ||
                    !["mocha", "testplane", "hermione"].includes(init.arguments[0].text)
                )
                    return undefined;
                name = declaration.propertyName?.getText(this.source) ?? node.text;
            } else return undefined;
        }
        return allowed.includes(name) ? name : undefined;
    }

    private report(node: ts.CallExpression, command = this.labels.get(node) ?? "command", message?: string): void {
        const { line, character } = this.source.getLineAndCharacterOfPosition(node.getStart(this.source));
        this.diagnostics.set(node, {
            code: "missing-await",
            file: this.options.file,
            line: line + 1,
            column: character + 1,
            command,
            message:
                message ??
                `Async command "${command}" is not awaited or returned on every analyzed path. Add await or return its promise.`,
        });
    }

    private bind(name: ts.BindingName, v: Value, state: State): void {
        if (ts.isIdentifier(name)) {
            state.bindings.set(this.binding(name), v);
        } else {
            name.elements.forEach((element, index) => {
                if (ts.isOmittedExpression(element)) return;
                const key = element.propertyName?.getText(this.source) ?? element.name.getText(this.source);
                const item = ts.isArrayBindingPattern(name)
                    ? v.items?.[index]
                    : v.kind === "context" && key === "browser"
                      ? value("browser")
                      : undefined;
                this.bind(element.name, item ?? value(), state);
            });
        }
    }

    private analyzeFunction(fn: FunctionNode, captured: State, args: Value[], frame: Frame): FunctionResult {
        const signature = this.checker.getSignatureFromDeclaration(fn);
        const result: FunctionResult = {
            promise:
                isAsync(fn) ||
                Boolean(signature && isPromiseType(this.checker, this.checker.getReturnTypeOfSignature(signature), fn)),
            returned: value(),
            pending: new Set(),
            consumed: new Set(),
        };
        if (!fn.body || this.visiting.has(fn)) return result;
        this.visiting.add(fn);
        const state = clone(captured);
        fn.parameters
            .filter(param => param.name.getText(this.source) !== "this")
            .forEach((param, i) =>
                this.bind(param.name, frame.root && i === 0 ? value("context") : (args[i] ?? value()), state),
            );
        const flow = ts.isBlock(fn.body)
            ? this.block(fn.body.statements, state, frame)
            : { exits: [{ kind: "return" as const, state, value: this.expression(fn.body, state, frame) }] };
        const returns: Value[] = [];
        const remaining = new Set<ts.CallExpression>();
        const completions = [
            ...flow.exits.filter(exit => exit.kind !== "throw"),
            ...(flow.normal ? [{ kind: "normal" as const, state: flow.normal }] : []),
        ];
        for (const exit of completions) {
            exit.state.pending.forEach(p => remaining.add(p));
            if (exit.kind === "return" && exit.value) {
                returns.push(exit.value);
                result.promise ||= exit.value.promises.size > 0;
                // Return transfers ownership and shape; it does not recursively await containers.
                allPromises(exit.value).forEach(p => {
                    if (exit.state.pending.has(p)) result.pending.add(p);
                });
                consume(exit.state, exit.value, !frame.root);
            }
            exit.state.pending.forEach(node => {
                if (!captured.pending.has(node)) this.report(node);
            });
        }
        if (completions.length)
            captured.pending.forEach(p => {
                if (!remaining.has(p)) result.consumed.add(p);
            });
        result.returned = joinedValue(returns);
        this.visiting.delete(fn);
        return result;
    }

    private block(statements: ts.NodeArray<ts.Statement>, state: State, frame: Frame): Flow {
        let normal: State | undefined = state;
        const exits: Exit[] = [];
        for (const statement of statements) {
            if (!normal) break;
            const next = this.statement(statement, normal, frame);
            normal = next.normal;
            exits.push(...next.exits);
        }
        return { normal, exits };
    }

    private statement(node: ts.Statement, state: State, frame: Frame): Flow {
        if (ts.isBlock(node)) return this.block(node.statements, state, frame);
        if (ts.isExpressionStatement(node)) this.expression(node.expression, state, frame);
        else if (ts.isVariableStatement(node)) this.declarations(node.declarationList, state, frame);
        else if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) {
            const v = node.expression ? this.expression(node.expression, state, frame) : value();
            return { exits: [{ kind: ts.isReturnStatement(node) ? "return" : "throw", state, value: v }] };
        } else if (ts.isBreakStatement(node) || ts.isContinueStatement(node)) {
            return { exits: [{ kind: ts.isBreakStatement(node) ? "break" : "continue", state }] };
        } else if (ts.isIfStatement(node)) {
            this.expression(node.expression, state, frame);
            const yes = this.statement(node.thenStatement, clone(state), frame);
            const no = node.elseStatement
                ? this.statement(node.elseStatement, clone(state), frame)
                : { normal: clone(state), exits: [] };
            return { normal: merge([yes.normal, no.normal]), exits: [...yes.exits, ...no.exits] };
        } else if (ts.isTryStatement(node)) {
            const tried = this.statement(node.tryBlock, clone(state), frame);
            const thrown = merge(tried.exits.filter(exit => exit.kind === "throw").map(exit => exit.state));
            // Without explicit throws, exception-entry state is unknown. Do not resurrect
            // promises already settled by the try (notably a handled rejection of await p).
            const completed = merge([
                tried.normal,
                ...tried.exits.map(exit => {
                    const finalState = clone(exit.state);
                    if (exit.kind === "return" && exit.value) consume(finalState, exit.value);
                    return finalState;
                }),
            ]);
            const caught = node.catchClause
                ? this.statement(node.catchClause.block, thrown ?? completed ?? clone(state), frame)
                : undefined;
            let flow: Flow = {
                normal: merge([tried.normal, caught?.normal]),
                exits: [...tried.exits.filter(exit => !caught || exit.kind !== "throw"), ...(caught?.exits ?? [])],
            };
            if (node.finallyBlock) {
                const exits: Exit[] = [];
                let normal: State | undefined;
                for (const entry of [
                    ...flow.exits,
                    ...(flow.normal ? [{ kind: "normal" as const, state: flow.normal }] : []),
                ]) {
                    const finalized = this.statement(node.finallyBlock, entry.state, frame);
                    exits.push(...finalized.exits);
                    if (finalized.normal) {
                        if (entry.kind === "normal") normal = finalized.normal;
                        else exits.push({ ...entry, state: finalized.normal });
                    }
                }
                flow = { normal, exits };
            }
            return flow;
        } else if (ts.isForOfStatement(node)) {
            const items = this.expression(node.expression, state, frame);
            if (items.kind === "array" && items.items) return this.arrayLoop(node, items.items, state, frame);
            const item = items.kind === "elements" ? value("element") : value();
            this.bindLoopItem(node, item, state);
            const body = this.statement(node.statement, clone(state), frame);
            return {
                normal: merge([
                    state,
                    body.normal,
                    ...body.exits.filter(e => e.kind === "break" || e.kind === "continue").map(e => e.state),
                ]),
                exits: body.exits.filter(e => e.kind === "return" || e.kind === "throw"),
            };
        } else if (
            ts.isForStatement(node) ||
            ts.isForInStatement(node) ||
            ts.isWhileStatement(node) ||
            ts.isDoStatement(node)
        ) {
            if (ts.isForStatement(node)) {
                if (node.initializer) {
                    if (ts.isVariableDeclarationList(node.initializer))
                        this.declarations(node.initializer, state, frame);
                    else this.expression(node.initializer, state, frame);
                }
                if (node.condition) this.expression(node.condition, state, frame);
            } else if (ts.isForInStatement(node)) {
                const items = this.expression(node.expression, state, frame);
                if (ts.isVariableDeclarationList(node.initializer)) {
                    const item = items.kind === "elements" ? value("element") : (items.items?.[0] ?? value());
                    node.initializer.declarations.forEach(d => this.bind(d.name, item, state));
                }
            } else this.expression(node.expression, state, frame);
            const body = this.statement(node.statement, clone(state), frame);
            if (ts.isForStatement(node) && node.incrementor && body.normal)
                this.expression(node.incrementor, body.normal, frame);
            return {
                normal: merge([
                    ts.isDoStatement(node) ? undefined : state,
                    body.normal,
                    ...body.exits
                        .filter(exit => exit.kind === "break" || exit.kind === "continue")
                        .map(exit => exit.state),
                ]),
                exits: body.exits.filter(exit => exit.kind === "return" || exit.kind === "throw"),
            };
        } else if (ts.isSwitchStatement(node)) {
            this.expression(node.expression, state, frame);
            const flows = node.caseBlock.clauses.map((_, i) =>
                this.block(
                    ts.factory.createNodeArray(node.caseBlock.clauses.slice(i).flatMap(c => [...c.statements])),
                    clone(state),
                    frame,
                ),
            );
            return {
                normal: merge([
                    node.caseBlock.clauses.some(ts.isDefaultClause) ? undefined : state,
                    ...flows.map(f => f.normal),
                    ...flows.flatMap(f => f.exits.filter(e => e.kind === "break").map(e => e.state)),
                ]),
                exits: flows.flatMap(f => f.exits.filter(e => e.kind !== "break")),
            };
        } else if (ts.isFunctionDeclaration(node) && node.name) {
            this.bind(node.name, { ...value("function"), fn: node }, state);
        }
        return { normal: state, exits: [] };
    }

    private bindLoopItem(node: ts.ForOfStatement, item: Value, state: State): void {
        if (node.awaitModifier) {
            consume(state, item);
            item = settled(item);
        }
        if (ts.isVariableDeclarationList(node.initializer))
            node.initializer.declarations.forEach(d => this.bind(d.name, item, state));
        else if (ts.isIdentifier(node.initializer)) this.bind(node.initializer, item, state);
    }

    private arrayLoop(node: ts.ForOfStatement, items: Value[], state: State, frame: Frame): Flow {
        let normal: State | undefined = state;
        const breaks: State[] = [];
        const exits: Exit[] = [];
        for (const item of items) {
            if (!normal) break;
            this.bindLoopItem(node, item, normal);
            const body = this.statement(node.statement, normal, frame);
            breaks.push(...body.exits.filter(exit => exit.kind === "break").map(exit => exit.state));
            exits.push(...body.exits.filter(exit => exit.kind === "return" || exit.kind === "throw"));
            normal = merge([
                body.normal,
                ...body.exits.filter(exit => exit.kind === "continue").map(exit => exit.state),
            ]);
        }
        return { normal: merge([normal, ...breaks]), exits };
    }

    private declarations(list: ts.VariableDeclarationList, state: State, frame: Frame): void {
        list.declarations.forEach(d =>
            this.bind(d.name, d.initializer ? this.expression(d.initializer, state, frame) : value(), state),
        );
    }

    private expression(input: ts.Expression, state: State, frame: Frame): Value {
        const node = unwrap(input);
        if (ts.isIdentifier(node)) {
            const existing = state.bindings.get(this.binding(node));
            if (existing) return existing;
            const declaration = this.checker.getSymbolAtLocation(node)?.valueDeclaration;
            if (declaration && declaration.getSourceFile() === this.source && isFunction(declaration))
                return { ...value("function"), fn: declaration };
            return value();
        }
        if (node.kind === ts.SyntaxKind.ThisKeyword) return frame.thisValue;
        if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) return { ...value("function"), fn: node };
        if (ts.isAwaitExpression(node)) {
            const v = this.expression(node.expression, state, frame);
            consume(state, v);
            return { ...v, promises: new Set() };
        }
        if (
            ts.isVoidExpression(node) ||
            ts.isTypeOfExpression(node) ||
            ts.isDeleteExpression(node) ||
            ts.isPrefixUnaryExpression(node) ||
            ts.isPostfixUnaryExpression(node)
        ) {
            this.expression("expression" in node ? node.expression : node.operand, state, frame);
            return value();
        }
        if (ts.isArrayLiteralExpression(node))
            return {
                ...value("array"),
                items: node.elements.flatMap(el => {
                    const item = this.expression(ts.isSpreadElement(el) ? el.expression : el, state, frame);
                    return ts.isSpreadElement(el) && item.items ? item.items : [item];
                }),
            };
        if (ts.isObjectLiteralExpression(node)) {
            for (const property of node.properties) {
                if (ts.isPropertyAssignment(property))
                    consume(state, this.expression(property.initializer, state, frame), true);
                else if (ts.isShorthandPropertyAssignment(property))
                    consume(state, this.expression(property.name, state, frame), true);
            }
            return value();
        }
        if (ts.isConditionalExpression(node)) {
            this.expression(node.condition, state, frame);
            const a = clone(state),
                b = clone(state);
            const av = this.expression(node.whenTrue, a, frame),
                bv = this.expression(node.whenFalse, b, frame);
            const joined = merge([a, b])!;
            state.bindings = joined.bindings;
            state.pending = joined.pending;
            return {
                kind: av.kind === bv.kind ? av.kind : "unknown",
                promises: new Set([...av.promises, ...bv.promises]),
                items: av.items || bv.items ? [...(av.items ?? []), ...(bv.items ?? [])] : undefined,
            };
        }
        if (ts.isBinaryExpression(node)) {
            const op = node.operatorToken.kind;
            if (op === ts.SyntaxKind.EqualsToken) {
                const v = this.expression(node.right, state, frame);
                if (ts.isIdentifier(node.left)) this.bind(node.left, v, state);
                else consume(state, v, true);
                return v;
            }
            const left = this.expression(node.left, state, frame);
            if (op === ts.SyntaxKind.CommaToken) return this.expression(node.right, state, frame);
            if (
                [
                    ts.SyntaxKind.AmpersandAmpersandToken,
                    ts.SyntaxKind.BarBarToken,
                    ts.SyntaxKind.QuestionQuestionToken,
                ].includes(op)
            ) {
                const branch = clone(state);
                const right = this.expression(node.right, branch, frame);
                const joined = merge([state, branch])!;
                state.bindings = joined.bindings;
                state.pending = joined.pending;
                // The left operand is used as a condition, not proof of an await.
                return op === ts.SyntaxKind.AmpersandAmpersandToken
                    ? right
                    : { ...right, promises: new Set([...left.promises, ...right.promises]) };
            }
            this.expression(node.right, state, frame);
            return value();
        }
        if (ts.isCallExpression(node)) return this.call(node, state, frame);
        const prop = member(node);
        if (prop) {
            const receiver = this.expression(prop.object, state, frame);
            if (receiver.kind === "context" && prop.name === "browser") return value("browser");
            return value();
        }
        if (ts.isElementAccessExpression(node)) {
            const receiver = this.expression(node.expression, state, frame);
            if (ts.isNumericLiteral(node.argumentExpression)) {
                if (receiver.kind === "elements") return { ...value("element"), promises: receiver.promises };
                return receiver.items?.[Number(node.argumentExpression.text)] ?? value();
            }
        }
        return value();
    }

    private promise(node: ts.CallExpression, name: string, state: State, kind: ValueKind = "unknown"): Value {
        this.labels.set(node, name);
        state.pending.add(node);
        return { ...value(kind), promises: new Set([node]) };
    }

    private callback(
        fn: FunctionNode,
        state: State,
        frame: Frame,
        args: Value[] = [],
        thisValue?: Value,
    ): FunctionResult {
        return this.analyzeFunction(fn, state, args, {
            root: false,
            thisValue: thisValue ?? (ts.isArrowFunction(fn) ? frame.thisValue : value()),
        });
    }

    private escapeCallback(fn: FunctionNode, state: State): void {
        const visit = (node: ts.Node): void => {
            if (ts.isIdentifier(node)) {
                const v = state.bindings.get(this.binding(node));
                if (v) consume(state, v, true);
            }
            ts.forEachChild(node, visit);
        };
        visit(fn);
    }

    private transfer(result: FunctionResult, state: State): void {
        result.consumed.forEach(p => state.pending.delete(p));
        result.pending.forEach(p => state.pending.add(p));
    }

    private adoptedPromise(node: ts.CallExpression, label: string, returned: Value, state: State): Value {
        consume(state, returned);
        return { ...returned, promises: this.promise(node, label, state).promises };
    }

    private call(node: ts.CallExpression, state: State, frame: Frame): Value {
        const prop = member(unwrap(node.expression));
        const receiver = prop
            ? this.expression(prop.object, state, frame)
            : this.expression(node.expression, state, frame);
        const name = prop?.name;
        const args = node.arguments.map(arg =>
            this.expression(ts.isSpreadElement(arg) ? arg.expression : arg, state, frame),
        );

        if (prop && ts.isIdentifier(prop.object) && prop.object.text === "Promise") {
            const decl = this.checker.getSymbolAtLocation(prop.object)?.valueDeclaration;
            if (
                (!decl || decl.getSourceFile().isDeclarationFile) &&
                ["all", "allSettled", "race", "any", "resolve"].includes(name!)
            ) {
                if (name === "resolve") return this.adoptedPromise(node, "Promise.resolve", args[0] ?? value(), state);
                const entries = args[0]?.items ?? [];
                entries.forEach(item => consume(state, item));
                const returned =
                    name === "all"
                        ? { ...value("array"), items: entries.map(settled) }
                        : name === "race" || name === "any"
                          ? joinedValue(entries.map(settled))
                          : value();
                return this.adoptedPromise(node, `Promise.${name}`, returned, state);
            }
        }

        if (name && ["then", "catch", "finally"].includes(name) && receiver.promises.size) {
            const returned: Value[] = [];
            args.forEach((arg, i) => {
                if (!arg.fn) return;
                const result = this.callback(
                    arg.fn,
                    state,
                    frame,
                    name === "then" && i === 0 ? [settled(receiver)] : [],
                );
                this.transfer(result, state);
                consume(state, result.returned);
                returned.push(settled(result.returned));
            });
            consume(state, receiver);
            const shape =
                name === "finally" || !returned.length
                    ? settled(receiver)
                    : joinedValue(name === "catch" ? [settled(receiver), ...returned] : returned);
            return this.adoptedPromise(node, name, shape, state);
        }

        if (
            name &&
            ["forEach", "map"].includes(name) &&
            prop &&
            (["array", "elements"].includes(receiver.kind) || isArrayType(this.checker, prop.object))
        ) {
            const fn = args[0]?.fn;
            const enhanced = receiver.kind === "elements";
            const inputs = enhanced ? [value("element")] : (receiver.items ?? [value()]);
            const items: Value[] = [];
            let async = false;
            if (fn) {
                for (const input of inputs) {
                    const result = this.callback(fn, state, frame, [input]);
                    this.transfer(result, state);
                    async ||= result.promise;
                    const item = result.promise
                        ? this.adoptedPromise(node, name, result.returned, state)
                        : result.returned;
                    items.push(item);
                }
            } else if (node.arguments[0]) {
                async = this.checker
                    .getSignaturesOfType(this.checker.getTypeAtLocation(node.arguments[0]), ts.SignatureKind.Call)
                    .some(signature =>
                        isPromiseType(
                            this.checker,
                            this.checker.getReturnTypeOfSignature(signature),
                            node.arguments[0],
                        ),
                    );
                if (async) items.push(this.promise(node, name, state));
            }
            if (enhanced) {
                // Both ChainablePromiseArray and resolved WDIO ElementArray use async iterators.
                consume(state, receiver);
                items.forEach(item => consume(state, item));
                const returned = name === "map" ? { ...value("array"), items: items.map(settled) } : value();
                return this.adoptedPromise(node, name, returned, state);
            }
            if (name === "forEach") {
                if (async) {
                    this.report(
                        node,
                        name,
                        "Array.forEach does not await async callbacks. Use for...of with await or await Promise.all(array.map(...)).",
                    );
                    items.forEach(item => consume(state, item));
                }
                return value();
            }
            return { ...value("array"), items };
        }

        if (name && ["browser", "element"].includes(receiver.kind)) {
            if (name === "addCommand" && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
                const elementScope = node.arguments[2]?.kind === ts.SyntaxKind.TrueKeyword;
                this.catalog[elementScope ? "element" : "browser"].add(node.arguments[0].text);
                if (args[1]?.fn)
                    this.callback(args[1].fn, state, frame, [], value(elementScope ? "element" : "browser"));
                return value();
            }
            if (syncCommands.has(name)) {
                args.forEach(arg => {
                    if (arg.fn) {
                        this.callback(arg.fn, state, frame);
                        this.escapeCallback(arg.fn, state);
                    }
                });
                return value();
            }
            if (name === "action") return value("action");
            if (
                this.catalog[receiver.kind as "browser" | "element"].has(name) ||
                elementCommands.has(name) ||
                elementsCommands.has(name)
            ) {
                if (name === "runStep" && args[1]?.fn) {
                    const result = this.callback(args[1].fn, state, frame);
                    this.transfer(result, state);
                    consume(state, receiver);
                    return this.adoptedPromise(node, name, result.returned, state);
                }
                if (!["execute", "executeAsync"].includes(name))
                    args.forEach(arg => {
                        if (arg.fn) this.callback(arg.fn, state, frame);
                    });
                consume(state, receiver);
                args.forEach(arg => consume(state, arg, true));
                return this.promise(
                    node,
                    name,
                    state,
                    elementCommands.has(name) ? "element" : elementsCommands.has(name) ? "elements" : "unknown",
                );
            }
        }
        if (receiver.kind === "action") {
            return name === "perform" ? this.promise(node, "perform", state) : value("action");
        }

        if (receiver.fn) {
            const result = this.callback(receiver.fn, state, frame, args);
            this.transfer(result, state);
            const label = name ?? node.expression.getText(this.source);
            return result.promise ? this.adoptedPromise(node, label, result.returned, state) : result.returned;
        }
        args.forEach(arg => {
            if (arg.fn) {
                this.callback(arg.fn, state, frame);
                this.escapeCallback(arg.fn, state);
            }
            // Unknown consumers may own the promise. This is an explicit coverage boundary.
            consume(state, arg, true);
        });
        const label = name ?? node.expression.getText(this.source);
        if (returnsPromise(this.checker, node)) return this.promise(node, label, state);
        if (returnsPromiseArray(this.checker, node))
            return { ...value("array"), items: [this.promise(node, label, state)] };
        return value();
    }
}

export function analyzeMissingAwait(source: string, options: AnalyzeOptions): MissingAwaitDiagnostic[] {
    const program = options.program ?? createSourceProgram(source, options.file);
    return new Analyzer(options, program).run();
}
