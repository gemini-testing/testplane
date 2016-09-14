'use strict';

const path = require('path');

const _ = require('lodash');

const ConfigReader = require('./config-reader');
const parseOptions = require('./options');

/*const initCliConfig = (commander) => {
    const cliConfig = {
        args:
    };
    console.log(_.pick(commander, ['args', 'browser', 'conf', 'grep', 'reporter']));
    // const cliConfig = {
        // args: commander.args
    // }
};*/

module.exports = class Config {
    static create(cliConfig, allowOverrides) {
        // initCliConfig(cliConfig);

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
        const configDir = config.conf ? path.dirname(config.conf) : process.cwd();

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
