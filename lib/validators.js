'use strict';

const format = require('util').format;

const chalk = require('chalk');
const _ = require('lodash');

const logger = require('./utils').logger;

exports.validateEmptyBrowsers = (browsers) => {
    if (_.isEmpty(browsers)) {
        throw new Error('"browsers" is required option and should not be empty');
    } else if (!_.isPlainObject(browsers)) {
        throw new Error('"browsers" should be an object');
    }
};

exports.validateUnknownBrowsers = (browsers, configBrowsers) => {
    const unknownBrowsers = getUnknownBrowsers(browsers, configBrowsers);

    if (_.isEmpty(unknownBrowsers)) {
        return;
    }

    logger.warn(format(
        '%s Unknown browser ids: %s. Use one of the browser ids specified in the config file: %s',
        chalk.yellow('WARNING:'), unknownBrowsers.join(', '), configBrowsers.join(', ')
    ));
};

function getUnknownBrowsers(browsers, configBrowsers) {
    return _(browsers)
        .compact()
        .uniq()
        .difference(configBrowsers)
        .value();
}
