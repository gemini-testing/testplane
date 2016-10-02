'use strict';

const _ = require('lodash');
const path = require('path');
const defaults = require('./defaults');
const logger = require('./utils').logger;

/**
 * Загружает конфиг и мержит с аргументами
 */
module.exports = class ConfigReader {
    constructor(options) {
        this._options = options;
        this._configPath = options.conf || defaults.conf;
    }

    read() {
        const customConfig = this.getConfigFromFile(this._configPath);
        const config = _.defaultsDeep(this._options, customConfig, defaults);

        if (config.prepareEnvironment) {
            config.prepareEnvironment();
        }

        _.forEach(config.browsers, (opts) => {
            opts.sessionsPerBrowser = opts.sessionsPerBrowser || config.sessionsPerBrowser;
            opts.retry = opts.retry || config.retry;
        });

        config.mochaOpts.grep = config.grep;

        return config;
    }

    getConfigFromFile(configPath) {
        try {
            return require(path.resolve(process.cwd(), configPath));
        } catch (e) {
            logger.error('Unable to read config from path ' + configPath);
            throw e;
        }
    }
};
