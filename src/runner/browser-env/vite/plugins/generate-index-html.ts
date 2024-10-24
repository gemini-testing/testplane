import path from "node:path";
import url from "node:url";
import { builtinModules } from "node:module";
import _ from "lodash";
import createDebug from "debug";
import { MODULE_NAMES, VITE_RUN_UUID_ROUTE, WORKER_ENV_BY_RUN_UUID } from "../constants";
import { getNodeModulePath, getImportMetaUrl } from "../utils";
import { polyfillPath } from "../polyfill";
import logger from "../../../../utils/logger";

import type { WorkerInitializePayload } from "../browser-modules/types";
import type { Plugin, Rollup } from "vite";

const debug = createDebug("vite:plugin:generateIndexHtml");

// modules that used only in NodeJS environment and don't need to be compiled
const DEFAULT_MODULES_TO_MOCK = ["puppeteer-core", "archiver", "@wdio/repl", "jszip"];
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

    const automationProtocolPath = `/@fs${driverModulePath}`;

    const mockDefaultModulePath = path.resolve(browserModulesPath, "mock/default-module.js");
    const mockImportMetaResolvePath = path.resolve(browserModulesPath, "mock/import-meta-resolve.js");
    const mockWdioLoggerPath = path.resolve(browserModulesPath, "mock/@wdio-logger.js");

    const modulesToMock = DEFAULT_MODULES_TO_MOCK.reduce((acc, val) => _.set(acc, val, mockDefaultModulePath), {
        "@wdio/logger": mockWdioLoggerPath,
        "import-meta-resolve": mockImportMetaResolvePath,
    }) as Record<string, string>;

    return [
        {
            name: "testplane:generateIndexHtml",
            enforce: "pre",
            configureServer(server) {
                return () => {
                    server.middlewares.use(async (req, res, next) => {
                        debug(`Received request for: ${req.originalUrl}`);

                        if (!req.url?.endsWith("index.html") || !req.originalUrl) {
                            return next();
                        }

                        const parsedUrl = url.parse(req.originalUrl);
                        const [routeName, runUuid] = _.compact(parsedUrl.pathname?.split("/"));

                        try {
                            if (routeName !== VITE_RUN_UUID_ROUTE || !runUuid) {
                                throw new Error(
                                    `Pathname must be in "/${VITE_RUN_UUID_ROUTE}/:uuid" format, but got: ${req.originalUrl}`,
                                );
                            }

                            const env = WORKER_ENV_BY_RUN_UUID.get(runUuid);
                            if (!env) {
                                throw new Error(
                                    `Worker environment is not found by "${runUuid}". ` +
                                        "This is possible if:\n" +
                                        '  - "runUuid" is not generated by Testplane\n' +
                                        "  - the test has already been completed\n" +
                                        "  - worker was disconnected",
                                );
                            }

                            const template = generateTemplate(env, runUuid);
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

                if (Object.keys(modulesToMock).includes(id)) {
                    return modulesToMock[id];
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
