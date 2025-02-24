import url from "node:url";
import path from "node:path";
import createDebug from "debug";
import { parse, print, visit, types } from "recast";

import { ManualMock } from "../manual-mock";
import * as logger from "../../../../utils/logger";
import { MOCK_MODULE_NAME } from "../constants";
import { getTestInfoFromViteRequest, getPathWithoutExtName } from "../utils";

import type { Plugin, Rollup } from "vite";

const debug = createDebug("vite:plugin:mock");
const b = types.builders;

type MockState = {
    importIndex: number;
    mockFnName: string;
    unmockFnName: string;
    mockCalls: (types.namedTypes.ExpressionStatement | types.namedTypes.ImportDeclaration)[];
};

type RewriteImportDeclarationOpts = {
    state: MockState;
    id: string;
    testFilePath: string | null;
    isTestModule: boolean;
    registeredMocks: Set<string>;
    testFileMocks: Map<string, string>;
};

type HandleMockCallsOpts = {
    state: MockState;
    registeredMocks: Set<string>;
    manualMock: ManualMock;
};

export const plugin = (manualMock: ManualMock): Plugin[] => {
    const registeredMocks = new Set<string>();
    const testFileMocks = new Map<string, string>();

    let testFilePath: string | null = null;

    return [
        {
            name: "testplane:manual-mock",
            enforce: "pre",
            resolveId: manualMock.resolveId.bind(manualMock),
        },
        {
            name: "testplane:mock",
            enforce: "post",
            configureServer(server) {
                return () => {
                    server.middlewares.use("/", async (req, _res, next) => {
                        const testInfo = getTestInfoFromViteRequest(req);
                        if (!testInfo) {
                            return next();
                        }

                        testFilePath = testInfo.env?.file;
                        manualMock.resetMocks();

                        return next();
                    });
                };
            },

            transform(code, id): Rollup.TransformResult {
                const isTestModule = testFilePath === id;

                if (!isTestModule) {
                    const isModuleFromNodeModules = id.includes("/node_modules/");
                    const isVirtualModule = id.startsWith("virtual:");
                    const hasRegisteredMocks = registeredMocks.size > 0;

                    if (isModuleFromNodeModules || isVirtualModule || !hasRegisteredMocks) {
                        return { code };
                    }
                }

                let ast: types.namedTypes.File;
                const start = Date.now();

                try {
                    ast = parse(code, {
                        parser: require("recast/parsers/typescript"),
                        sourceFileName: id,
                        sourceRoot: path.dirname(id),
                    });

                    debug(`Parsed file for mocking: ${id} in ${Date.now() - start}ms`);
                } catch (err) {
                    logger.error(`Failed to parse file ${id}: ${(err as Error).stack}`);

                    return { code };
                }

                const state: MockState = {
                    importIndex: 0,
                    mockFnName: "",
                    unmockFnName: "",
                    mockCalls: [],
                };

                const testModuleVisitorMethods = isTestModule
                    ? { visitExpressionStatement: handleMockCalls({ state, registeredMocks, manualMock }) }
                    : {};

                visit(ast, {
                    visitImportDeclaration: handleModuleImportWithMocks(state),
                    ...testModuleVisitorMethods,
                });

                visit(ast, {
                    visitImportDeclaration: rewriteImportDeclaration({
                        state,
                        id,
                        testFilePath,
                        isTestModule,
                        registeredMocks,
                        testFileMocks,
                    }),
                });

                const preparedMockCalls = state.mockCalls.map(mockCall => {
                    const exp = mockCall as types.namedTypes.ExpressionStatement;

                    if (!isCallExpression(exp)) {
                        return mockCall;
                    }

                    const mockCallExpression = exp.expression as types.namedTypes.CallExpression;
                    const mockModuleName = (mockCallExpression.arguments[0] as types.namedTypes.Literal)
                        .value as string;

                    if (testFileMocks.has(mockModuleName)) {
                        mockCallExpression.arguments.push(b.identifier(testFileMocks.get(mockModuleName)!));
                    } else {
                        throw new Error(`Cannot find mocked module "${mockModuleName}"`);
                    }

                    return b.expressionStatement(b.awaitExpression(mockCallExpression));
                });

                ast.program.body.unshift(...preparedMockCalls);

                try {
                    const newCode = print(ast, { sourceMapName: id });
                    debug(`Transformed file for mocking: ${id} in ${Date.now() - start}ms`);

                    return newCode;
                } catch (err) {
                    logger.error(`Failed to transform file ${id} for mocking: ${(err as Error).stack}`);
                    return { code };
                }
            },
        },
    ];
};

/**
 * Find import module with mocks and save name for mock and unmock calls
 */
function handleModuleImportWithMocks(state: MockState): types.Visitor["visitImportDeclaration"] {
    return function (nodePath) {
        const declaration = nodePath.value as types.namedTypes.ImportDeclaration;
        const source = declaration.source.value!;
        const specifiers = declaration.specifiers as types.namedTypes.ImportSpecifier[];

        if (!specifiers || specifiers.length === 0 || source !== MOCK_MODULE_NAME) {
            return this.traverse(nodePath);
        }

        const mockSpecifier = specifiers
            .filter(s => s.type === types.namedTypes.ImportSpecifier.toString())
            .find(s => s.imported.name === "mock");

        if (mockSpecifier && mockSpecifier.local) {
            state.mockFnName = mockSpecifier.local.name as string;
        }

        const unmockSpecifier = (declaration.specifiers as types.namedTypes.ImportSpecifier[])
            .filter(s => s.type === types.namedTypes.ImportSpecifier.toString())
            .find(s => s.imported.name === "unmock");

        if (unmockSpecifier && unmockSpecifier.local) {
            state.unmockFnName = unmockSpecifier.local.name as string;
        }

        // Move import module with mocks to the top of the file
        state.mockCalls.push(declaration);
        nodePath.prune();

        return this.traverse(nodePath);
    };
}

/**
 * Detect which modules are supposed to be mocked
 */
function handleMockCalls({
    state,
    registeredMocks,
    manualMock,
}: HandleMockCallsOpts): types.Visitor["visitExpressionStatement"] {
    return function (nodePath) {
        const exp = nodePath.value as types.namedTypes.ExpressionStatement;

        if (exp.expression.type !== types.namedTypes.CallExpression.toString()) {
            return this.traverse(nodePath);
        }

        const callExp = exp.expression as types.namedTypes.CallExpression;
        const isMockCall =
            Boolean(state.mockFnName) && (callExp.callee as types.namedTypes.Identifier).name === state.mockFnName;
        const isUnmockCall =
            Boolean(state.unmockFnName) && (callExp.callee as types.namedTypes.Identifier).name === state.unmockFnName;

        if (!isMockCall && !isUnmockCall) {
            return this.traverse(nodePath);
        }

        if (
            isUnmockCall &&
            callExp.arguments[0] &&
            typeof (callExp.arguments[0] as types.namedTypes.Literal).value === "string"
        ) {
            manualMock.unmock((callExp.arguments[0] as types.namedTypes.Literal).value as string);
        }

        if (isMockCall) {
            const mockCall = exp.expression as types.namedTypes.CallExpression;

            if (mockCall.arguments.length === 1) {
                manualMock.mock((mockCall.arguments[0] as types.namedTypes.StringLiteral).value);
            } else {
                if ((exp.expression as types.namedTypes.CallExpression).arguments.length) {
                    registeredMocks.add(
                        ((exp.expression as types.namedTypes.CallExpression).arguments[0] as types.namedTypes.Literal)
                            .value as string,
                    );
                }

                state.mockCalls.push(exp);
            }
        }

        // Remove original node from ast
        nodePath.prune();

        return this.traverse(nodePath);
    };
}
/**
 * Rewrite import declarations in test file and its dependencies in order to use user mocks instead original module.
 * Exmample in test file:
 *
 * From:
 *   import {fn, mock} from "testplane/mock";
 *   import {foo} from "bar";
 *   import {handleClick} from "./utils";
 *   mock("./utils", () => ({handleClick: fn()});
 *
 * To:
 *   import * as __testplane_import_0__ from "./utils"; // move import of mocked module to the top
 *   await mock("utils", () => ({handleClick: fn()}, __testplane_import_0__); // move right after import original module (will call `mock` from `vite/browser-modules/mock.ts`)
 *   const {foo} = await import("bar"); // transform to import expression in order to import it only after mock module
 *   const {handleClick} = importWithMock("/Users/../utils", __testplane_import_0__); // use importWithMock helper in order to get mocked module
}));
 */
function rewriteImportDeclaration({
    state,
    id,
    testFilePath,
    isTestModule,
    registeredMocks,
    testFileMocks,
}: RewriteImportDeclarationOpts): types.Visitor["visitImportDeclaration"] {
    return function (nodePath) {
        const declaration = nodePath.value as types.namedTypes.ImportDeclaration;
        const source = declaration.source.value as string;

        if (!declaration.specifiers || declaration.specifiers.length === 0) {
            return this.traverse(nodePath);
        }

        const absImportPath = path.resolve(path.dirname(id), source);
        const absImportPathWithoutExtName = getPathWithoutExtName(absImportPath);

        const isModuleMockedRelatively = Boolean(
            source.startsWith(".") &&
                [...registeredMocks.values()].find(m => {
                    const absMockPath = path.resolve(path.dirname(testFilePath || "/"), m);
                    const absMockPathWithoutExtName = getPathWithoutExtName(absMockPath);

                    return absImportPathWithoutExtName === absMockPathWithoutExtName;
                }),
        );

        const isModuleMocked = isModuleMockedRelatively || registeredMocks.has(source);
        const newImportIdentifier = genImportIdentifier(state);

        if (isTestModule && isModuleMocked) {
            testFileMocks.set(source, newImportIdentifier);
        }

        /**
         * Use import with custom namespace specifier for mocked module
         *
         * From:
         *   import {handleClick} from "./utils";
         *
         * To:
         *   import * as __testplane_import_0__ from "./utils";
         */
        if (isModuleMocked) {
            const newNode = b.importDeclaration(
                [b.importNamespaceSpecifier(b.identifier(newImportIdentifier))],
                b.literal(source),
            );

            // should be specified first in order to correctly mock module
            state.mockCalls.unshift(newNode);
        }

        let mockImport: types.namedTypes.VariableDeclaration | undefined;

        /**
         * Transform import mocked module to use helper `importWithMock` in order to get mocked implementation
         *
         * From:
         *   import {handleClick} from "./utils";
         *
         * To:
         *   import * as __testplane_import_0__ from "./utils"; // from code above
         *   const { handleClick } = await importWithMock("./utils", __testplane_import_0__);
         */
        if (isModuleMocked) {
            const mockModuleIdentifier =
                source.startsWith(".") || source.startsWith("/")
                    ? url.pathToFileURL(absImportPathWithoutExtName).pathname
                    : source;

            const variableValue = b.callExpression(b.identifier("importWithMock"), [
                b.literal(mockModuleIdentifier),
                b.identifier(newImportIdentifier),
            ]);

            mockImport = b.variableDeclaration("const", [
                b.variableDeclarator(genVarDeclKey(declaration), variableValue),
            ]);
        }

        /**
         * Transform not mocked import declarations to import expressions only in test file.
         * In order to hoist `mock(...)` calls and run them before another dependencies.
         *
         * From:
         *   import {foo} from "bar";
         *
         * To:
         *   const {foo} = await import("bar");
         */
        if (isTestModule && !isModuleMocked) {
            mockImport = b.variableDeclaration("const", [
                b.variableDeclarator(
                    genVarDeclKey(declaration),
                    b.awaitExpression(b.importExpression(b.literal(source))),
                ),
            ]);
        }

        if (mockImport) {
            nodePath.replace(mockImport);
        }

        return this.traverse(nodePath);
    };
}

function genVarDeclKey(
    declaration: types.namedTypes.ImportDeclaration,
): types.namedTypes.Identifier | types.namedTypes.ObjectPattern {
    const isNamespaceImport =
        declaration.specifiers?.length === 1 &&
        declaration.specifiers[0].type === types.namedTypes.ImportNamespaceSpecifier.toString();

    if (isNamespaceImport) {
        return declaration.specifiers![0].local as types.namedTypes.Identifier;
    }

    return b.objectPattern(
        declaration.specifiers!.map(s => {
            if (s.type === types.namedTypes.ImportDefaultSpecifier.toString()) {
                return b.property("init", b.identifier("default"), b.identifier(s.local!.name as string));
            }

            return b.property(
                "init",
                b.identifier((s as types.namedTypes.ImportSpecifier).imported.name as string),
                b.identifier(s.local!.name as string),
            );
        }),
    );
}

function genImportIdentifier(state: MockState): string {
    return `__testplane_import_${state.importIndex++}__`;
}

function isCallExpression(exp: types.namedTypes.ExpressionStatement): boolean {
    return exp.expression && exp.expression.type === types.namedTypes.CallExpression.toString();
}
