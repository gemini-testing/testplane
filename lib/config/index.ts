import _ from 'lodash';
import path from 'path';

import BrowserConfig from './browser-config';
import CommonConfig from './common-config';
import defaults from './defaults';
import parseOptions from './options';
import * as logger from '../utils/logger';

import type { Config as ConfigType } from '../types/config';

function isObjectLike(value: unknown): value is object {
    return typeof value == 'object' && value !== null;
}

export default class Config extends CommonConfig {
    public configPath: string | null;
    private config: ConfigType;
    public browsers: {[browserId: string]: BrowserConfig};

    public static create(config: ConfigType | string): Config {
        return new this(config);
    }

    public static read(configPath: string): ConfigType {
        try {
            return require(path.resolve(process.cwd(), configPath));
        } catch (e) {
            logger.error(`Unable to read config from path ${configPath}`);
            throw e;
        }
    }

    constructor(config: ConfigType | string = defaults.config) {
        let options: ConfigType, configPath: string | null;

        if (isObjectLike(config)) {
            configPath = null;
            options = config;
        } else {
            configPath = config;
            options = Config.read(config);
        }

        if (_.isFunction(options.prepareEnvironment)) {
            options.prepareEnvironment();
        }

        const parsedConfig = parseOptions({
            options,
            env: process.env,
            argv: process.argv
        });

        super(parsedConfig);

        this.configPath = configPath;
        this.config = parsedConfig;
        this.browsers = _.mapValues(this.config.browsers, (browser, id) => {
            const browserOptions = _.extend({},
                browser,
                {
                    id: id,
                    system: this.config.system
                }
            );

            return new BrowserConfig(browserOptions);
        });
    }

    public forBrowser(id: string): BrowserConfig {
        return this.browsers[id];
    }

    public getBrowserIds(): Array<string> {
        return _.keys(this.browsers);
    }

    public serialize() {
        return _.extend({}, this.config, {
            browsers: _.mapValues(this.browsers, (broConf) => broConf.serialize())
        });
    }

    /**
     * This method is used in subrocesses to merge a created config
     * in a subrocess with a config from the main process
     */
    public mergeWith(config: ConfigType): void {
        _.mergeWith(this.config, config, (l, r) => {
            if (_.isObjectLike(l)) {
                return;
            }

            // When passing stringified config from the master to workers
            // all functions are transformed to strings and all regular expressions to empty objects
            return typeof l === typeof r ? r : l;
        });
    }

    public get prepareEnvironment(): ConfigType['prepareEnvironment'] {
        return this.config.prepareEnvironment;
    }

    public get system(): ConfigType['system'] {
        return this.config.system;
    }

    public get plugins(): ConfigType['plugins'] {
        return this.config.plugins;
    }

    public get sets(): ConfigType['sets'] {
        return this.config.sets;
    }
};
