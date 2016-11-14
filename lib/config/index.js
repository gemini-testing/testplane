'use strict';

const path = require('path');
const _ = require('lodash');
const logger = require('../utils').logger;
const parseOptions = require('./options');

module.exports = class Config {
    static create(configPath, cliOpts, allowOverrides) {
        allowOverrides = _.defaults(allowOverrides || {}, {
            env: false,
            cli: false
        });

        cliOpts = cliOpts || {};

        const env = allowOverrides.env ? process.env : {};
        const argv = allowOverrides.cli ? process.argv : [];

        const configFromFile = Config.read(configPath);
        const parsedConfig = parseOptions({options: configFromFile, env, argv});

        const config = _.merge(parsedConfig, cliOpts);

        return new Config(config);
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

    constructor(config) {
        _.extend(this, config);
        this._browsersConfigs = _.mapValues(this.browsers, (data, id) => _.extend({id}, data, this.system));
    }

    forBrowser(id) {
        return this._browsersConfigs[id];
    }

    getBrowserIds() {
        return Object.keys(this._browsersConfigs);
    }
};
