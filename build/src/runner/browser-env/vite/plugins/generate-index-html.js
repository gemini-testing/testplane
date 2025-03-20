"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = void 0;
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = __importDefault(require("node:url"));
const node_module_1 = require("node:module");
const lodash_1 = __importDefault(require("lodash"));
const debug_1 = __importDefault(require("debug"));
const constants_1 = require("../constants");
const utils_1 = require("../utils");
const polyfill_1 = require("../polyfill");
const logger = __importStar(require("../../../../utils/logger"));
const debug = (0, debug_1.default)("vite:plugin:generateIndexHtml");
// modules that used only in NodeJS environment and don't need to be compiled
const DEFAULT_MODULES_TO_STUB = [
    "puppeteer-core", "archiver", "@testplane/wdio-repl", "jszip",
    'import-meta-resolve', 'archiver', 'glob', '@testplane/devtools', 'ws', 'decamelize',
    'geckodriver', 'safaridriver', 'edgedriver', '@puppeteer/browsers', 'locate-app', 'wait-port',
    'lodash.isequal'
];
const POLYFILLS = [...node_module_1.builtinModules, ...node_module_1.builtinModules.map(m => `node:${m}`)];
const virtualDriverModuleId = "virtual:@testplane/driver";
const virtualModules = {
    driver: {
        id: virtualDriverModuleId,
        resolvedId: `\0${virtualDriverModuleId}`,
    },
};
const plugin = async () => {
    const mochaPackagePath = await (0, utils_1.getNodeModulePath)({
        moduleName: "mocha",
        parent: node_path_1.default.join("node_modules", "testplane", "node_modules"),
    });
    const mochaModulePath = node_path_1.default.join(node_url_1.default.fileURLToPath(node_path_1.default.dirname(mochaPackagePath)), "mocha.js");
    const dirname = node_url_1.default.fileURLToPath(new URL(".", (0, utils_1.getImportMetaUrl)(__filename)));
    const browserModulesPath = node_path_1.default.resolve(dirname, "..", "browser-modules");
    const browserRunnerModulePath = node_path_1.default.resolve(browserModulesPath, "index.js");
    const globalsModulePath = node_path_1.default.resolve(browserModulesPath, "globals.js");
    const driverModulePath = node_path_1.default.resolve(browserModulesPath, "driver.js");
    const mockModulePath = node_path_1.default.resolve(browserModulesPath, "mock.js");
    console.log('browserModulesPath:', browserModulesPath);
    console.log('globalsModulePath:', globalsModulePath);
    const automationProtocolPath = `/@fs${driverModulePath}`;
    const stubDefaultModulePath = node_path_1.default.resolve(browserModulesPath, "stubs/default-module.js");
    const stubImportMetaResolvePath = node_path_1.default.resolve(browserModulesPath, "stubs/import-meta-resolve.js");
    const stubWdioLoggerPath = node_path_1.default.resolve(browserModulesPath, "stubs/@testplane-wdio-logger.js");
    const modulesToStub = DEFAULT_MODULES_TO_STUB.reduce((acc, val) => lodash_1.default.set(acc, val, stubDefaultModulePath), {
        // "@wdio/logger": stubWdioLoggerPath,
        "@testplane/wdio-logger": stubWdioLoggerPath,
        "import-meta-resolve": stubImportMetaResolvePath,
    });
    return [
        {
            name: "testplane:generateIndexHtml",
            enforce: "pre",
            configureServer(server) {
                return () => {
                    server.middlewares.use(async (req, res, next) => {
                        debug(`Received request for: ${req.originalUrl}`);
                        try {
                            const testInfo = (0, utils_1.getTestInfoFromViteRequest)(req);
                            if (!testInfo) {
                                return next();
                            }
                            const template = generateTemplate(testInfo.env, testInfo.runUuid);
                            res.end(await server.transformIndexHtml(`${req.originalUrl}`, template));
                        }
                        catch (err) {
                            const template = generateErrorTemplate(err);
                            logger.error(`Failed to render template: ${err}`);
                            res.end(await server.transformIndexHtml(`${req.originalUrl}`, template));
                        }
                        return next();
                    });
                };
            },
            resolveId: async (id) => {
                console.log('id:', id);
                if (id === virtualModules.driver.id) {
                    return virtualModules.driver.resolvedId;
                }
                // fake module and load the implementation of the browser mock
                if (id === constants_1.MOCK_MODULE_NAME) {
                    return mockModulePath;
                }
                if (id.endsWith(constants_1.MODULE_NAMES.browserRunner)) {
                    return browserRunnerModulePath;
                }
                if (id.endsWith(constants_1.MODULE_NAMES.globals)) {
                    return globalsModulePath;
                }
                if (id.endsWith(constants_1.MODULE_NAMES.mocha)) {
                    return mochaModulePath;
                }
                if (POLYFILLS.includes(id)) {
                    return (0, polyfill_1.polyfillPath)(id.replace("/promises", ""));
                }
                if (Object.keys(modulesToStub).includes(id)) {
                    return modulesToStub[id];
                }
            },
            load: (id) => {
                if (id === virtualModules.driver.resolvedId) {
                    return `export const automationProtocolPath = ${JSON.stringify(automationProtocolPath)};`;
                }
            },
            transform(code, id) {
                if (id.includes(".vite/deps/expect.js")) {
                    return {
                        code: code.replace("var fs = _interopRequireWildcard(require_graceful_fs());", "var fs = {};"),
                    };
                }
                return { code };
            },
        },
    ];
};
exports.plugin = plugin;
function generateTemplate(env, runUuid) {
    return `
<!DOCTYPE html>
<html>
    <head>
        <title>Testplane Browser Test</title>
        <link rel="icon" href="https://testplane.io/img/favicon.ico">
        <script type="module">
            window.__testplane__ = ${JSON.stringify({ runUuid, ...env })};
            window.__testplane__.mockCache = new Map();
            window.importWithMock = function(modName, mod) {
                if (window.__testplane__.mockCache.has(modName)) {
                    return window.__testplane__.mockCache.get(modName);
                }

                return mod;
            }
        </script>
        <script type="module" src="${constants_1.MODULE_NAMES.globals}"></script>
        <script type="module" src="${constants_1.MODULE_NAMES.mocha}"></script>
        <script type="module" src="${constants_1.MODULE_NAMES.browserRunner}"></script>
    </head>
    <body></body>
</html>
`;
}
function generateErrorTemplate(error) {
    return `
<!DOCTYPE html>
<html>
    <body>
        <pre>${error.stack}</pre>
    </body>
</html>
`;
}
//# sourceMappingURL=generate-index-html.js.map