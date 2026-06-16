import path from "path";
import _ from "lodash";
import defaults from "./defaults";
import { BrowserConfig } from "./browser-config";
import parseOptions from "./options";
import * as logger from "../utils/logger";
import { ConfigInput, ConfigInputData, ConfigParsed } from "./types";
import { addUserAgentToArgs } from "./utils";

export { TimeTravelMode, SelectivityMode } from "./types";

export class Config {
    configPath?: string;

    static async create(config?: string | ConfigInput): Promise<Config> {
        try {
            const { configPath, options } = await Config._resolve(config);

            await Config._prepareEnvironment(options);

            return new Config(options, configPath);
        } catch (e: unknown) {
            const error = new Error(`Got an error while trying to read config: ${(e as Error).message}`);
            error.stack = (e as Error).stack;
            error.cause = (e as Error).cause;

            throw error;
        }
    }

    static async read(configPath: string): Promise<ConfigInputData> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const configModule = require(path.resolve(process.cwd(), configPath));
            const exported = (configModule.__esModule ? configModule.default : configModule) as ConfigInput;

            return await Config._resolveExportedConfig(exported);
        } catch (e) {
            logger.error(`Unable to read config from path ${configPath}`);
            throw e;
        }
    }

    private static async _resolve(
        config?: string | ConfigInput,
    ): Promise<{ configPath?: string; options: ConfigInputData }> {
        if (typeof config === "function") {
            return { options: await Config._resolveExportedConfig(config) };
        }

        if (_.isObjectLike(config)) {
            return { options: config as ConfigInputData };
        }

        if (typeof config === "string") {
            return { configPath: config, options: await Config.read(config) };
        }

        const located = Config._locateConfigPath();

        if (!located) {
            throw new Error(`Unable to read config from paths: ${defaults.configPaths.join(", ")}`);
        }

        return { configPath: located, options: await Config.read(located) };
    }

    private static _locateConfigPath(): string | null {
        for (const configPath of defaults.configPaths) {
            try {
                const resolvedConfigPath = path.resolve(configPath);
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                require(resolvedConfigPath);

                return resolvedConfigPath;
            } catch (err: unknown) {
                if ((err as { code?: string }).code !== "MODULE_NOT_FOUND") {
                    throw err;
                }
            }
        }

        return null;
    }

    private static async _resolveExportedConfig(exported: ConfigInput): Promise<ConfigInputData> {
        const resolved = typeof exported === "function" ? await (exported as () => unknown)() : exported;

        return resolved as ConfigInputData;
    }

    private static async _prepareEnvironment(options: ConfigInputData): Promise<void> {
        if (_.isFunction(options.prepareEnvironment)) {
            await options.prepareEnvironment();
        }
    }

    constructor(options: ConfigInputData, configPath?: string) {
        if (configPath) {
            this.configPath = configPath;
        }

        const parsedOptions = parseOptions({
            options,
            env: process.env,
            argv: process.argv,
        }) as ConfigParsed;

        addUserAgentToArgs(parsedOptions);

        _.extend(this, parsedOptions);

        this.browsers = _.mapValues(this.browsers, (browser, id) => {
            const browserOptions = _.extend({}, browser, {
                id: id,
                system: this.system,
                lastFailed: this.lastFailed,
            });

            return new BrowserConfig(browserOptions);
        });
    }

    forBrowser(id: string): BrowserConfig {
        return this.browsers[id];
    }

    getBrowserIds(): Array<string> {
        return _.keys(this.browsers);
    }

    serialize(): Omit<Config, "system"> {
        return _.extend({}, this, {
            browsers: _.mapValues(this.browsers, broConf => broConf.serialize()),
        });
    }

    /**
     * This method is used in subrocesses to merge a created config
     * in a subrocess with a config from the main process
     */
    mergeWith(config: Config): void {
        _.mergeWith(this, config, (l, r) => {
            if (_.isObjectLike(l)) {
                return;
            }

            // When passing stringified config from the master to workers
            // all functions are transformed to strings and all regular expressions to empty objects
            return typeof l === typeof r ? r : l;
        });
    }
}
