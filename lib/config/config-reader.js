'use strict';

const path = require('path');

const _ = require('lodash');

const defaults = require('./defaults');
const logger = require('../utils').logger;

module.exports = class ConfigReader {
    constructor(config) {
        this._config = config;
        this._configPath = config.conf || defaults.conf;
    }

    read() {
        const customConfig = this.getConfigFromFile(this._configPath);
        const config = _.defaultsDeep(this._config, customConfig, defaults);

        if (config.prepareEnvironment) {
            config.prepareEnvironment();
        }

        return config;
    }

    getConfigFromFile(configPath) {
        try {
            return require(path.resolve(process.cwd(), configPath));
        } catch (e) {
            logger.error(`Unable to read config from path ${configPath}`);
            throw e;
        }
    }
};
