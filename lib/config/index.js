'use strict';

const path = require('path');

const _ = require('lodash');

const ConfigReader = require('./config-reader');
const parseOptions = require('./options');

module.exports = (config, allowOverrides) => {
    allowOverrides = _.defaults(allowOverrides || {}, {
        env: false,
        cli: false
    });

    const env = allowOverrides.env ? process.env : {};
    const argv = allowOverrides.cli ? process.argv : [];

    config = readConfig(config);

    return parseOptions({options: config, env, argv});
};

function readConfig(config) {
    config = new ConfigReader(config).read();
    const configDir = config.conf ? path.dirname(config.conf) : process.cwd();

    return _.set(config, 'projectRoot', config.projectRoot
        ? path.resolve(configDir, config.projectRoot)
        : configDir);
}
