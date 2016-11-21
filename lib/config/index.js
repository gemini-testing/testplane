'use strict';

const path = require('path');
const _ = require('lodash');
const logger = require('../utils').logger;
const parseOptions = require('./options');

module.exports = class Config {
    static create(configPath, allowOverrides) {
        return new Config(configPath, allowOverrides);
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

    constructor(config, allowOverrides) {
        allowOverrides = _.defaults(allowOverrides || {}, {
            env: false,
            cli: false
        });

        if (_.isString(config)) {
            config = Config.read(config);
        }

        _.extend(this, parseOptions({
            options: config,
            env: allowOverrides.env ? process.env : {},
            argv: allowOverrides.cli ? process.argv : []
        }));
    }

    forBrowser(id) {
        return this.browsers[id];
    }

    getBrowserIds() {
        return _.keys(this.browsers);
    }
};
