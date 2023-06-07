"use strict";

const path = require("path");
const _ = require("lodash");
const BrowserConfig = require("./browser-config");
const defaults = require("./defaults");
const parseOptions = require("./options");
const logger = require("../utils/logger");

module.exports = class Config {
    static create(config) {
        return new Config(config);
    }

    static read(configPath) {
        try {
            return require(path.resolve(process.cwd(), configPath));
        } catch (e) {
            logger.error(`Unable to read config from path ${configPath}`);
            throw e;
        }
    }

    constructor(config) {
        let options;
        if (_.isObjectLike(config)) {
            options = config;
        } else if (typeof config === "string") {
            this.configPath = config;
            options = Config.read(config);
        } else {
            for (const configPath of defaults.configPaths) {
                try {
                    const resolvedConfigPath = path.resolve(configPath);
                    require(resolvedConfigPath);
                    this.configPath = resolvedConfigPath;

                    break;
                } catch (err) {
                    if (err.code !== "MODULE_NOT_FOUND") {
                        throw err;
                    }
                }
            }

            if (!this.configPath) {
                throw new Error(`Unable to read config from paths: ${defaults.configPaths.join(", ")}`);
            }

            options = Config.read(this.configPath);
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

    forBrowser(id) {
        return this.browsers[id];
    }

    getBrowserIds() {
        return _.keys(this.browsers);
    }

    serialize() {
        return _.extend({}, this, {
            browsers: _.mapValues(this.browsers, broConf => broConf.serialize()),
        });
    }

    /**
     * This method is used in subrocesses to merge a created config
     * in a subrocess with a config from the main process
     */
    mergeWith(config) {
        _.mergeWith(this, config, (l, r) => {
            if (_.isObjectLike(l)) {
                return;
            }

            // When passing stringified config from the master to workers
            // all functions are transformed to strings and all regular expressions to empty objects
            return typeof l === typeof r ? r : l;
        });
    }
};
