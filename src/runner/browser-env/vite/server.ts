// remove after migrate to esm
process.env.VITE_CJS_IGNORE_WARNING = "1";

import path from "node:path";
import { createServer } from "vite";
import _ from "lodash";
import getPort from "get-port";
import chalk from "chalk";

import logger from "../../../utils/logger";
import { createSocketServer } from "./socket";
import { plugin as generateIndexHtml } from "./plugins/generate-index-html";
import { Config } from "../../../config";
import { VITE_DEFAULT_CONFIG_ENV } from "./constants";

import type { ViteDevServer, UserConfig, InlineConfig } from "vite";
import type { BrowserTestRunEnvOptions } from "./types";

export class ViteServer {
    private _testplaneConfig: Config;
    private _viteConfig: Partial<InlineConfig>;
    private _options?: BrowserTestRunEnvOptions;
    private _server?: ViteDevServer;

    static create<T extends ViteServer>(this: new (testplaneConfig: Config) => T, testplaneConfig: Config): T {
        return new this(testplaneConfig);
    }

    constructor(testplaneConfig: Config) {
        this._testplaneConfig = testplaneConfig;
        this._viteConfig = {
            server: { host: "localhost" },
            configFile: false,
            logLevel: "silent",
            build: {
                sourcemap: "inline",
            },
            optimizeDeps: {
                // listed deps are CJS packages and need to be compiled to ESM by Vite
                include: [
                    "expect",
                    // webdriverio deps
                    "aria-query",
                    "css-shorthand-properties",
                    "css-value",
                    "grapheme-splitter",
                    "lodash.clonedeep",
                    "lodash.zip",
                    "minimatch",
                    "rgb2hex",
                    "ws",
                ],
                esbuildOptions: {
                    logLevel: "silent",
                },
            },
        };

        this._options = _.isArray(this._testplaneConfig.system.testRunEnv)
            ? this._testplaneConfig.system.testRunEnv[1]
            : undefined;
    }

    async start(): Promise<void> {
        await this._applyUserViteConfig();
        await this._addRequiredVitePlugins();

        if (!this._viteConfig.server!.port) {
            this._viteConfig.server!.port = await getPort();
        }

        this._server = await createServer(this._viteConfig);
        createSocketServer(this._server.httpServer);

        await this._server.listen();

        logger.log(chalk.green(`Vite server started on ${this.baseUrl}`));
    }

    async close(): Promise<void> {
        await this._server?.close();
    }

    private async _applyUserViteConfig(): Promise<void> {
        if (!this._options?.viteConfig) {
            return;
        }

        const config = this._options.viteConfig;
        let preparedConfig: UserConfig;

        if (_.isString(config)) {
            preparedConfig = (await import(path.resolve(process.cwd(), config))).default as UserConfig;
        } else if (_.isFunction(config)) {
            preparedConfig = await config(VITE_DEFAULT_CONFIG_ENV);
        } else {
            preparedConfig = config;
        }

        this._viteConfig = _.merge(this._viteConfig, preparedConfig);
    }

    private async _addRequiredVitePlugins(): Promise<void> {
        this._viteConfig.plugins = [...(this._viteConfig.plugins || []), await generateIndexHtml()];
    }

    get baseUrl(): string | undefined {
        return this._server?.resolvedUrls!.local[0];
    }
}
