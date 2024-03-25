import path from "node:path";
import url from "node:url";
import { createServer } from "vite";
import _ from "lodash";
import getPort from "get-port";
import chalk from "chalk";

import logger from "../../../utils/logger";
import { plugin as generateIndexHtml } from "./plugins/generate-index-html";
import { plugin as resolveModulePaths } from "./plugins/resolve-module-paths";
import { Config } from "../../../config";
import { VITE_DEFAULT_CONFIG_ENV } from "./constants";
import { getNodeModulePath } from "./utils";
import { BrowserWorkerCommunicator } from "./communicator";

import type { ViteDevServer, InlineConfig } from "vite";
import type { BrowserTestRunEnvOptions } from "./types";

export class ViteServer {
    #hermioneConfig: Config;
    #viteConfig: Partial<InlineConfig>;
    #options?: BrowserTestRunEnvOptions;
    #server?: ViteDevServer;

    static create<T extends ViteServer>(this: new (hermioneConfig: Config) => T, hermioneConfig: Config): T {
        return new this(hermioneConfig);
    }

    constructor(hermioneConfig: Config) {
        this.#hermioneConfig = hermioneConfig;
        this.#viteConfig = {
            server: { host: "localhost" },
            configFile: false,
            // logLevel: "silent",
            build: {
                sourcemap: "inline",
                commonjsOptions: {
                    include: [/node_modules/],
                }
            },
            optimizeDeps: {
                include: [
                    // 'ws',
                    'expect', 'minimatch', 'css-shorthand-properties', 'lodash.merge', 'lodash.zip', 'ws',
                    'lodash.clonedeep', 'lodash.pickby', 'lodash.flattendeep', 'aria-query', 'grapheme-splitter',
                    'css-value', 'rgb2hex', 'p-iteration', 'deepmerge-ts', 'jest-util', 'jest-matcher-utils', 'split2',
                    // ------
                    // '@wdio/protocols',
                    // 'proxy-agent', 'url', 'debug', 'unbzip2-stream', 'extract-zip', 'util', '@puppeteer/browsers', 'archiver'
                ],
            }
            // optimizeDeps: {
            //     esbuildOptions: {
            //         logLevel: "silent",
            //     },
            // },
        };

        this.#options = _.isArray(this.#hermioneConfig.system.testRunEnv)
            ? this.#hermioneConfig.system.testRunEnv[1]
            : undefined;
    }

    async start(): Promise<void> {
        if (this.#options?.preset) {
            const pkg = '@vitejs/plugin-react';

            // try {
            //     return await import(pkg)
            // } catch (err: any) {
            //     throw new Error(
            //         `Couldn't load preset "${preset}" given important dependency ("${pkg}") is not installed.\n` +
            //         `Please run:\n\n\tnpm install ${pkg}\n\tor\n\tyarn add --dev ${pkg}`
            //     )
            // }
            const plugin = (await import(pkg)).default;
            console.log('plugin:', plugin);

            if (plugin) {
                this.#viteConfig.plugins = [plugin()];

                // this.#viteConfig.plugins = [plugin({
                //     babel: {
                //         assumptions: {
                //             setPublicClassFields: true
                //         },
                //         parserOpts: {
                //             plugins: ['decorators-legacy', 'classProperties']
                //         }
                //     }
                // })];
            }

            // const [pkg, importProp, opts] = PRESET_DEPENDENCIES[this.#options.preset] || []
            // const plugin = (await userfriendlyImport(this.#options.preset, pkg))[importProp || 'default']
            // if (plugin) {
            //     this.#viteConfig.plugins!.push(plugin(opts))
            // }
        }

        await this.#applyUserViteConfig();
        await this.#addRequiredVitePlugins();

        if (!this.#viteConfig.server!.port) {
            this.#viteConfig.server!.port = await getPort();
        }

        this.#server = await createServer(this.#viteConfig);
        BrowserWorkerCommunicator.create(this.#server.ws).handleMessages();

        await this.#server.listen();

        logger.log(chalk.green(`Vite server started on ${this.baseUrl}`));
    }

    async close(): Promise<void> {
        await this.#server?.close();
    }

    async #applyUserViteConfig(): Promise<void> {
        if (!this.#options?.viteConfig) {
            return;
        }

        const config = this.#options.viteConfig;
        let preparedConfig: InlineConfig;

        if (_.isString(config)) {
            preparedConfig = (await import(path.resolve(process.cwd(), config))).default as InlineConfig;
        } else if (_.isFunction(config)) {
            preparedConfig = await config(VITE_DEFAULT_CONFIG_ENV);
        } else {
            preparedConfig = config;
        }

        this.#viteConfig = _.merge(this.#viteConfig, preparedConfig);
    }

    async #addRequiredVitePlugins(): Promise<void> {
        const mochaPath = await getNodeModulePath({
            moduleName: "mocha",
            parent: path.join("node_modules", "hermione", "node_modules"),
        });
        const webdriverioPath = await getNodeModulePath({
            moduleName: "webdriverio",
            parent: path.join("node_modules", "hermione", "node_modules"),
        });
        console.log('webdriverioPath:', webdriverioPath);

        const modulePaths = {
            mocha: path.join(url.fileURLToPath(path.dirname(mochaPath)), "mocha.js"),
            webdriverio: path.join(url.fileURLToPath(webdriverioPath)),
        };

        console.log('modulePaths:', modulePaths);

        this.#viteConfig.plugins = [
            ...(this.#viteConfig.plugins || []),
            generateIndexHtml(),
            resolveModulePaths({ ...this.#options, modulePaths }),
        ];
    }

    get baseUrl(): string | undefined {
        return this.#server?.resolvedUrls!.local[0];
    }
}
