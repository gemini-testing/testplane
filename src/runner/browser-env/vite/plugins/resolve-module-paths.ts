import url from "node:url";
import path from "node:path";
import { builtinModules } from 'node:module';
import _ from "lodash";
import { polyfillPath } from 'modern-node-polyfills'

// import { getImportMetaUrl, normalizeId, getNodeModulePath } from "../utils";
import { getImportMetaUrl, normalizeId } from "../utils";
import { MODULE_NAMES } from "../constants";

import type { Plugin } from "vite";
import type { VitePluginOptions } from "../types";

// import {
//     WebDriverProtocol, MJsonWProtocol, JsonWProtocol, AppiumProtocol,
//     ChromiumProtocol, SauceLabsProtocol, SeleniumProtocol, GeckoProtocol,
//     WebDriverBidiProtocol
// } from "@wdio/protocols";

// const WDIO_PACKAGES = ['webdriverio', 'expect-webdriverio']
// const WDIO_PACKAGES = ['webdriverio'];

// const commands = _.merge(
//     WebDriverProtocol, MJsonWProtocol, JsonWProtocol, AppiumProtocol,
//     ChromiumProtocol, SauceLabsProtocol, SeleniumProtocol, GeckoProtocol,
//     WebDriverBidiProtocol
// ) as Record<string, Record<string, {command: string}>>;
// const protocolCommandList = Object.values(commands).map(
//     (endpoint) => Object.values(endpoint).map(
//         ({ command }) => command
//     )
// ).flat()

const virtualModuleId = 'virtual:hermione';
const resolvedVirtualModuleId = '\0' + virtualModuleId;

/**
 * these modules are used in Node.js environments only and
 * don't need to be compiled, we just have them point to a
 * mocked module that returns a matching interface without
 * functionality
 */
const MODULES_TO_MOCK = [
    'import-meta-resolve', 'puppeteer-core', 'archiver', 'glob', 'devtools', 'decamelize', 'got',
    'geckodriver', 'safaridriver', 'edgedriver', '@puppeteer/browsers', 'locate-app', 'wait-port',
    'lodash.isequal', '@wdio/repl',
];

const POLYFILLS = [
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`)
];

export const plugin = (options: VitePluginOptions): Plugin[] => {
    const dirname = url.fileURLToPath(new URL(".", getImportMetaUrl(__filename)));

    const browserModulesPath = path.resolve(dirname, "..", "browser-modules");
    const browserRunnerModulePath = path.resolve(browserModulesPath, "index.js");
    const globalsModulePath = path.resolve(browserModulesPath, "globals.js");

    const mockModulePath = path.resolve(browserModulesPath, 'mock.js');
    const expectModulePath = path.resolve(browserModulesPath, 'expect.js');

    const automationProtocolPath = `/@fs${url.pathToFileURL(path.resolve(browserModulesPath, 'driver.js')).pathname}`;

    return [
        {
            name: "hermione:resolveModulePaths",
            enforce: "pre",
            resolveId: async (id): Promise<string | void> => {
                if (id === virtualModuleId) {
                    return resolvedVirtualModuleId
                }

                if (POLYFILLS.includes(id)) {
                // if (id.startsWith('@wdio/utils') || POLYFILLS.includes(id)) {
                    return polyfillPath(normalizeId(id.replace('/promises', '')));
                }

                if (id.endsWith(MODULE_NAMES.browserRunner)) {
                    return browserRunnerModulePath;
                }

                if (id.endsWith(MODULE_NAMES.globals)) {
                    return globalsModulePath;
                }

                if (id.endsWith(MODULE_NAMES.mocha)) {
                    return options.modulePaths.mocha;
                }

                if (id === "webdriverio") {
                    return options.modulePaths.webdriverio;
                }

                if (id === "expect-webdriverio") {
                    return expectModulePath;
                }

                if (MODULES_TO_MOCK.includes(id)) {
                    return mockModulePath
                }

                // /Users/dudkevich/job/projects/dudkevich-scripts/HERMIONE-913.wdio_component_testing_2/node_modules/@wdio/utils/build/index.js
                // /Users/dudkevich/job/hermione-test-project-2/node_modules/@wdio/utils/build/index.js

                // if (id.startsWith('@wdio') || WDIO_PACKAGES.includes(id)) {
                // if (id.startsWith('@wdio/utils')) {
                //     console.log('ID:', id);

                //     // return url.fileURLToPath(await resolve(id, import.meta.url))
                //     const wdioModule = url.fileURLToPath(await getNodeModulePath({
                //         moduleName: id,
                //         parent: path.join("node_modules", "hermione", "node_modules"),
                //     }));

                //     console.log('wdioModule:', wdioModule);

                //     return wdioModule;
                // }

                // if (WDIO_PACKAGES.includes(id)) {
                //     return url.fileURLToPath(await resolve(id, import.meta.url))
                // }
            },

            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            load: async (id) => {
                /**
                 * provide a list of protocol commands to generate the prototype in the browser
                 */
                if (id === resolvedVirtualModuleId) {
                    console.log('BEFORE RESOLVE MODULE');

                    // const {
                    //     WebDriverProtocol, MJsonWProtocol, JsonWProtocol, AppiumProtocol,
                    //     ChromiumProtocol, SauceLabsProtocol, SeleniumProtocol, GeckoProtocol,
                    //     WebDriverBidiProtocol
                    // } = await import("@wdio/protocols");
                    // const res = await import("@wdio/protocols");
                    // console.log('res:', res);

                    // const {
                    //     WebDriverProtocol, MJsonWProtocol, JsonWProtocol, AppiumProtocol,
                    //     ChromiumProtocol, SauceLabsProtocol, SeleniumProtocol, GeckoProtocol,
                    //     WebDriverBidiProtocol
                    // } = res;

                    // } = await eval(`import("import-meta-resolve")`);

                    // const commands = _.merge(
                    //     WebDriverProtocol, MJsonWProtocol, JsonWProtocol, AppiumProtocol,
                    //     ChromiumProtocol, SauceLabsProtocol, SeleniumProtocol, GeckoProtocol,
                    //     WebDriverBidiProtocol
                    // ) as Record<string, Record<string, {command: string}>>;

                    // console.log('commands:', commands);

                    // const protocolCommandList = Object.values(commands).map(
                    //     (endpoint) => Object.values(endpoint).map(
                    //         ({ command }) => command
                    //     )
                    // ).flat();

                    // console.log('protocolCommandList:', protocolCommandList);
                    // export const commands = ${JSON.stringify(protocolCommandList)};

                    return `
                        export const automationProtocolPath = ${JSON.stringify(automationProtocolPath)};
                    `
                };

                return;
            },
        },
    ];
};
