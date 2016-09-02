'use strict';

const path = require('path');

const _ = require('lodash');

const defaults = require('./defaults');
const logger = require('../utils').logger;
const validateUnknownBrowsers = require('../validators').validateUnknownBrowsers;

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

        return _.set(config, 'browsers', this._filterBrowsers(config.browsers));
    }

    _filterBrowsers(configBrowsers) {
        const skipBrowsers = this._getBrowsersToSkip();

        validateUnknownBrowsers(skipBrowsers, _.keys(configBrowsers));

        return _.omit(configBrowsers, function(capabilities, name) {
            return _.includes(skipBrowsers, name);
        });
    }

    _getBrowsersToSkip() {
        const browsers = process.env.HERMIONE_SKIP_BROWSERS;

        return browsers ? browsers.split(/, */) : [];
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
