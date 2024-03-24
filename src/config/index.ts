import * as path from "node:path";
import _ from "lodash";

import { configPaths as defaultConfigPaths } from "./defaults.js";
import { BrowserConfig } from "./browser-config.js";
import parseOptions from "./options.js";
import logger from "../utils/logger.js";
import { ConfigInput } from "./types.js";

export class Config {
    configPath!: string;

    static create(config?: string | ConfigInput): Config {
        return new Config(config);
    }

    static read(configPath: string): unknown {
        try {
            console.log('configPath:', configPath);

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const configModule = require(path.resolve(process.cwd(), configPath));

            return configModule.__esModule ? configModule.default : configModule;
        } catch (e) {
            logger.error(`Unable to read config from path ${configPath}`);
            throw e;
        }
    }

    constructor(config?: string | ConfigInput) {
        let options: ConfigInput;
        if (_.isObjectLike(config)) {
            options = config as ConfigInput;
        } else if (typeof config === "string") {
            this.configPath = config;
            options = Config.read(config) as ConfigInput;
        } else {
            for (const configPath of defaultConfigPaths) {
                console.log('configPath:', configPath);

                try {
                    const resolvedConfigPath = path.resolve(configPath);
                    console.log('resolvedConfigPath:', resolvedConfigPath);

                    require(resolvedConfigPath);
                    this.configPath = resolvedConfigPath;

                    break;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (err: any) {
                    if (err.code !== "MODULE_NOT_FOUND") {
                        throw err;
                    }
                }
            }

            if (!this.configPath) {
                throw new Error(`Unable to read config from paths: ${defaultConfigPaths.join(", ")}`);
            }

            options = Config.read(this.configPath) as ConfigInput;
        }

        if (_.isFunction(options.prepareEnvironment)) {
            options.prepareEnvironment();
        }

        _.extend(
            this,
            parseOptions({
                options,
                env: process.env,
                argv: process.argv,
            }),
        );

        this.browsers = _.mapValues(this.browsers, (browser, id) => {
            const browserOptions = _.extend({}, browser, {
                id: id,
                system: this.system,
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
