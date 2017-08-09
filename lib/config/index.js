'use strict';

const path = require('path');
const _ = require('lodash');
const logger = require('../utils').logger;
const parseOptions = require('./options');

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

    constructor(configPath) {
        this.configPath = configPath;

        _.extend(this, parseOptions({
            options: Config.read(configPath),
            env: process.env,
            argv: process.argv
        }));
    }

    forBrowser(id) {
        return _.extend(this.browsers[id], {id});
    }

    getBrowserIds() {
        return _.keys(this.browsers);
    }

    getConfigPath() {
        return this._configPath;
    }

    getAllowedOverrides() {
        return this._allowOverrides;
    }

    mergeWith(config) {
        _.mergeWith(this, config, (l, r) => {
            if (_.isObjectLike(l)) {
                return;
            }

            return typeof l === typeof r ? r : l;
        });
    }
};
