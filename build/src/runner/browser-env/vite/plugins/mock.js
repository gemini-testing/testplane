"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = void 0;
const node_url_1 = __importDefault(require("node:url"));
const node_path_1 = __importDefault(require("node:path"));
const debug_1 = __importDefault(require("debug"));
const recast_1 = require("recast");
const logger_1 = __importDefault(require("../../../../utils/logger"));
const constants_1 = require("../constants");
const utils_1 = require("../utils");
const debug = (0, debug_1.default)("vite:plugin:mock");
const b = recast_1.types.builders;
const plugin = (manualMock) => {
    const registeredMocks = new Set();
    const testFileMocks = new Map();
    let testFilePath = null;
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
                        const testInfo = (0, utils_1.getTestInfoFromViteRequest)(req);
                        if (!testInfo) {
                            return next();
                        }
                        testFilePath = testInfo.env?.file;
                        manualMock.resetMocks();
                        return next();
                    });
                };
            },
            transform(code, id) {
                const isTestModule = testFilePath === id;
                if (!isTestModule) {
                    const isModuleFromNodeModules = id.includes("/node_modules/");
                    const isVirtualModule = id.startsWith("virtual:");
                    const hasRegisteredMocks = registeredMocks.size > 0;
                    if (isModuleFromNodeModules || isVirtualModule || !hasRegisteredMocks) {
                        return { code };
                    }
                }
                let ast;
                const start = Date.now();
                try {
                    ast = (0, recast_1.parse)(code, {
                        parser: require("recast/parsers/typescript"),
                        sourceFileName: id,
                        sourceRoot: node_path_1.default.dirname(id),
                    });
                    debug(`Parsed file for mocking: ${id} in ${Date.now() - start}ms`);
                }
                catch (err) {
                    logger_1.default.error(`Failed to parse file ${id}: ${err.stack}`);
                    return { code };
                }
                const state = {
                    importIndex: 0,
                    mockFnName: "",
                    unmockFnName: "",
                    mockCalls: [],
                };
                const testModuleVisitorMethods = isTestModule
                    ? { visitExpressionStatement: handleMockCalls({ state, registeredMocks, manualMock }) }
                    : {};
                (0, recast_1.visit)(ast, {
                    visitImportDeclaration: handleModuleImportWithMocks(state),
                    ...testModuleVisitorMethods,
                });
                (0, recast_1.visit)(ast, {
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
                    const exp = mockCall;
                    if (!isCallExpression(exp)) {
                        return mockCall;
                    }
                    const mockCallExpression = exp.expression;
                    const mockModuleName = mockCallExpression.arguments[0]
                        .value;
                    if (testFileMocks.has(mockModuleName)) {
                        mockCallExpression.arguments.push(b.identifier(testFileMocks.get(mockModuleName)));
                    }
                    else {
                        throw new Error(`Cannot find mocked module "${mockModuleName}"`);
                    }
                    return b.expressionStatement(b.awaitExpression(mockCallExpression));
                });
                ast.program.body.unshift(...preparedMockCalls);
                try {
                    const newCode = (0, recast_1.print)(ast, { sourceMapName: id });
                    debug(`Transformed file for mocking: ${id} in ${Date.now() - start}ms`);
                    return newCode;
                }
                catch (err) {
                    logger_1.default.error(`Failed to transform file ${id} for mocking: ${err.stack}`);
                    return { code };
                }
            },
        },
    ];
};
exports.plugin = plugin;
/**
 * Find import module with mocks and save name for mock and unmock calls
 */
function handleModuleImportWithMocks(state) {
    return function (nodePath) {
        const declaration = nodePath.value;
        const source = declaration.source.value;
        const specifiers = declaration.specifiers;
        if (!specifiers || specifiers.length === 0 || source !== constants_1.MOCK_MODULE_NAME) {
            return this.traverse(nodePath);
        }
        const mockSpecifier = specifiers
            .filter(s => s.type === recast_1.types.namedTypes.ImportSpecifier.toString())
            .find(s => s.imported.name === "mock");
        if (mockSpecifier && mockSpecifier.local) {
            state.mockFnName = mockSpecifier.local.name;
        }
        const unmockSpecifier = declaration.specifiers
            .filter(s => s.type === recast_1.types.namedTypes.ImportSpecifier.toString())
            .find(s => s.imported.name === "unmock");
        if (unmockSpecifier && unmockSpecifier.local) {
            state.unmockFnName = unmockSpecifier.local.name;
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
function handleMockCalls({ state, registeredMocks, manualMock, }) {
    return function (nodePath) {
        const exp = nodePath.value;
        if (exp.expression.type !== recast_1.types.namedTypes.CallExpression.toString()) {
            return this.traverse(nodePath);
        }
        const callExp = exp.expression;
        const isMockCall = Boolean(state.mockFnName) && callExp.callee.name === state.mockFnName;
        const isUnmockCall = Boolean(state.unmockFnName) && callExp.callee.name === state.unmockFnName;
        if (!isMockCall && !isUnmockCall) {
            return this.traverse(nodePath);
        }
        if (isUnmockCall &&
            callExp.arguments[0] &&
            typeof callExp.arguments[0].value === "string") {
            manualMock.unmock(callExp.arguments[0].value);
        }
        if (isMockCall) {
            const mockCall = exp.expression;
            if (mockCall.arguments.length === 1) {
                manualMock.mock(mockCall.arguments[0].value);
            }
            else {
                if (exp.expression.arguments.length) {
                    registeredMocks.add(exp.expression.arguments[0]
                        .value);
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
function rewriteImportDeclaration({ state, id, testFilePath, isTestModule, registeredMocks, testFileMocks, }) {
    return function (nodePath) {
        const declaration = nodePath.value;
        const source = declaration.source.value;
        if (!declaration.specifiers || declaration.specifiers.length === 0) {
            return this.traverse(nodePath);
        }
        const absImportPath = node_path_1.default.resolve(node_path_1.default.dirname(id), source);
        const absImportPathWithoutExtName = (0, utils_1.getPathWithoutExtName)(absImportPath);
        const isModuleMockedRelatively = Boolean(source.startsWith(".") &&
            [...registeredMocks.values()].find(m => {
                const absMockPath = node_path_1.default.resolve(node_path_1.default.dirname(testFilePath || "/"), m);
                const absMockPathWithoutExtName = (0, utils_1.getPathWithoutExtName)(absMockPath);
                return absImportPathWithoutExtName === absMockPathWithoutExtName;
            }));
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
            const newNode = b.importDeclaration([b.importNamespaceSpecifier(b.identifier(newImportIdentifier))], b.literal(source));
            // should be specified first in order to correctly mock module
            state.mockCalls.unshift(newNode);
        }
        let mockImport;
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
            const mockModuleIdentifier = source.startsWith(".") || source.startsWith("/")
                ? node_url_1.default.pathToFileURL(absImportPathWithoutExtName).pathname
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
                b.variableDeclarator(genVarDeclKey(declaration), b.awaitExpression(b.importExpression(b.literal(source)))),
            ]);
        }
        if (mockImport) {
            nodePath.replace(mockImport);
        }
        return this.traverse(nodePath);
    };
}
function genVarDeclKey(declaration) {
    const isNamespaceImport = declaration.specifiers?.length === 1 &&
        declaration.specifiers[0].type === recast_1.types.namedTypes.ImportNamespaceSpecifier.toString();
    if (isNamespaceImport) {
        return declaration.specifiers[0].local;
    }
    return b.objectPattern(declaration.specifiers.map(s => {
        if (s.type === recast_1.types.namedTypes.ImportDefaultSpecifier.toString()) {
            return b.property("init", b.identifier("default"), b.identifier(s.local.name));
        }
        return b.property("init", b.identifier(s.imported.name), b.identifier(s.local.name));
    }));
}
function genImportIdentifier(state) {
    return `__testplane_import_${state.importIndex++}__`;
}
function isCallExpression(exp) {
    return exp.expression && exp.expression.type === recast_1.types.namedTypes.CallExpression.toString();
}
//# sourceMappingURL=mock.js.map