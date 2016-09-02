'use strict';

const path = require('path');

const _ = require('lodash');

const ConfigReader = require('./config-reader');
const parseOptions = require('./options');

module.exports = class Config {
    static create(config, allowOverrides) {
        allowOverrides = _.defaults(allowOverrides || {}, {
            env: false,
            cli: false
        });

        const env = allowOverrides.env ? process.env : {};
        const argv = allowOverrides.cli ? process.argv : [];

        return new Config(config, env, argv);
    }

    constructor(config, env, argv) {
        this.config = config;
        this.env = env;
        this.argv = argv;
    }

    parse() {
        const config = new ConfigReader(this.config).read();
        const configDir = config.conf ? path.dirname(config.conf) : process.cwd();

        config.projectRoot = config.projectRoot
            ? path.resolve(configDir, config.projectRoot)
            : configDir;

        return parseOptions({
            options: this.config,
            env: this.env,
            argv: this.argv
        });
    }
};
