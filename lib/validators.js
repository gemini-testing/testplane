'use strict';

var chalk = require('chalk'),
    _ = require('lodash'),
    logger = require('./utils').logger,
    format = require('util').format;

exports.validateUnknownBrowsers = function(browsers, configBrowsers) {
    var unknownBrowsers = getUnknownBrowsers(browsers, configBrowsers);

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
