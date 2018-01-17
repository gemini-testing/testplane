'use strict';

const path = require('path');
const _ = require('lodash');
const logger = require('../utils/logger');
const parseOptions = require('./options');
const defaults = require('./defaults');
const BrowserConfig = require('./browser-config');

module.exports = class Config {
    static create(configPath) {
        return new Config(configPath);
    }

    static read(configPath) {
        const config = Config._getConfigFromFile(configPath);

        if (_.isFunction(config.prepareEnvironment)) {
            config.prepareEnvironment();
        }

        return config;
    }

    static _getConfigFromFile(configPath) {
        try {
            return require(path.resolve(process.cwd(), configPath));
        } catch (e) {
            logger.error(`Unable to read config from path ${configPath}`);
            throw e;
        }
    }

    constructor(configPath = defaults.config) {
        this.configPath = configPath;

        _.extend(this, parseOptions({
            options: Config.read(configPath),
            env: process.env,
            argv: process.argv
        }));

        this.browsers = _.mapValues(this.browsers, (browser, id) => {
            return new BrowserConfig(id, browser, this.system);
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
            browsers: _.mapValues(this.browsers, (broConf) => broConf.serialize())
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
