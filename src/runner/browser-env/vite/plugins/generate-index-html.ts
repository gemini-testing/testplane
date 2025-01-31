import path from "node:path";
import url from "node:url";
import { builtinModules } from "node:module";
import _ from "lodash";
import createDebug from "debug";
import { MODULE_NAMES, MOCK_MODULE_NAME } from "../constants";
import { getNodeModulePath, getImportMetaUrl, getTestInfoFromViteRequest } from "../utils";
import { polyfillPath } from "../polyfill";
import * as logger from "../../../../utils/logger";

import type { WorkerInitializePayload } from "../browser-modules/types";
import type { Plugin, Rollup } from "vite";

const debug = createDebug("vite:plugin:generateIndexHtml");

// modules that used only in NodeJS environment and don't need to be compiled
const DEFAULT_MODULES_TO_STUB = ["puppeteer-core", "archiver", "@wdio/repl", "jszip"];
const POLYFILLS = [...builtinModules, ...builtinModules.map(m => `node:${m}`)];

const virtualDriverModuleId = "virtual:@testplane/driver";

const virtualModules = {
    driver: {
        id: virtualDriverModuleId,
        resolvedId: `\0${virtualDriverModuleId}`,
    },
};

export const plugin = async (): Promise<Plugin[]> => {
    const mochaPackagePath = await getNodeModulePath({
        moduleName: "mocha",
        parent: path.join("node_modules", "testplane", "node_modules"),
    });
    const mochaModulePath = path.join(url.fileURLToPath(path.dirname(mochaPackagePath)), "mocha.js");

    const dirname = url.fileURLToPath(new URL(".", getImportMetaUrl(__filename)));
    const browserModulesPath = path.resolve(dirname, "..", "browser-modules");
    const browserRunnerModulePath = path.resolve(browserModulesPath, "index.js");
    const globalsModulePath = path.resolve(browserModulesPath, "globals.js");
    const driverModulePath = path.resolve(browserModulesPath, "driver.js");
    const mockModulePath = path.resolve(browserModulesPath, "mock.js");

    const automationProtocolPath = `/@fs${driverModulePath}`;

    const stubDefaultModulePath = path.resolve(browserModulesPath, "stubs/default-module.js");
    const stubImportMetaResolvePath = path.resolve(browserModulesPath, "stubs/import-meta-resolve.js");
    const stubWdioLoggerPath = path.resolve(browserModulesPath, "stubs/@wdio-logger.js");

    const modulesToStub = DEFAULT_MODULES_TO_STUB.reduce((acc, val) => _.set(acc, val, stubDefaultModulePath), {
        "@wdio/logger": stubWdioLoggerPath,
        "import-meta-resolve": stubImportMetaResolvePath,
    }) as Record<string, string>;

    return [
        {
            name: "testplane:generateIndexHtml",
            enforce: "pre",
            configureServer(server) {
                return () => {
                    server.middlewares.use(async (req, res, next) => {
                        debug(`Received request for: ${req.originalUrl}`);

                        try {
                            const testInfo = getTestInfoFromViteRequest(req);
                            if (!testInfo) {
                                return next();
                            }

                            const template = generateTemplate(testInfo.env, testInfo.runUuid);
                            res.end(await server.transformIndexHtml(`${req.originalUrl}`, template));
                        } catch (err) {
                            const template = generateErrorTemplate(err as Error);
                            logger.error(`Failed to render template: ${err}`);
                            res.end(await server.transformIndexHtml(`${req.originalUrl}`, template));
                        }

                        return next();
                    });
                };
            },

            resolveId: async (id: string): Promise<string | void> => {
                if (id === virtualModules.driver.id) {
                    return virtualModules.driver.resolvedId;
                }

                // fake module and load the implementation of the browser mock
                if (id === MOCK_MODULE_NAME) {
                    return mockModulePath;
                }

                if (id.endsWith(MODULE_NAMES.browserRunner)) {
                    return browserRunnerModulePath;
                }

                if (id.endsWith(MODULE_NAMES.globals)) {
                    return globalsModulePath;
                }

                if (id.endsWith(MODULE_NAMES.mocha)) {
                    return mochaModulePath;
                }

                if (POLYFILLS.includes(id)) {
                    return polyfillPath(id.replace("/promises", ""));
                }

                if (Object.keys(modulesToStub).includes(id)) {
                    return modulesToStub[id];
                }
            },

            load: (id: string): Rollup.LoadResult | void => {
                if (id === virtualModules.driver.resolvedId) {
                    return `export const automationProtocolPath = ${JSON.stringify(automationProtocolPath)};`;
                }
            },

            transform(code, id): Rollup.TransformResult {
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

function generateTemplate(env: WorkerInitializePayload, runUuid: string): string {
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
        <script type="module" src="${MODULE_NAMES.globals}"></script>
        <script type="module" src="${MODULE_NAMES.mocha}"></script>
        <script type="module" src="${MODULE_NAMES.browserRunner}"></script>
    </head>
    <body></body>
</html>
`;
}

function generateErrorTemplate(error: Error): string {
    return `
<!DOCTYPE html>
<html>
    <body>
        <pre>${error.stack}</pre>
    </body>
</html>
`;
}
