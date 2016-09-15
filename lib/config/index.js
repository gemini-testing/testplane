'use strict';

const path = require('path');

const _ = require('lodash');

const ConfigReader = require('./config-reader');
const parseOptions = require('./options');

module.exports = class Config {
    static create(cliConfig, allowOverrides) {
        allowOverrides = _.defaults(allowOverrides || {}, {
            env: false,
            cli: false
        });

        const env = allowOverrides.env ? process.env : {};
        const argv = allowOverrides.cli ? process.argv : [];

        return new Config(cliConfig, env, argv);
    }

    constructor(cliConfig, env, argv) {
        this.cliConfig = cliConfig;
        this.env = env;
        this.argv = argv;
    }

    parse() {
        const config = new ConfigReader(this.cliConfig).read();
        const configDir = config.config ? path.dirname(config.config) : process.cwd();

        config.projectRoot = _.isString(config.projectRoot)
            ? path.resolve(configDir, config.projectRoot)
            : configDir;

        return parseOptions({
            options: config,
            env: this.env,
            argv: this.argv
        });
    }
};
