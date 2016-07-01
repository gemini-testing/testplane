'use strict';

var inherit = require('inherit'),
    _ = require('lodash'),
    path = require('path'),
    defaults = require('./defaults'),
    logger = require('./utils').logger,
    validateUnknownBrowsers = require('./validators').validateUnknownBrowsers;

/**
 * Загружает конфиг и мержит с аргументами
 */
module.exports = inherit({
    __constructor: function(options) {
        this._options = options;
        this._configPath = options.conf || defaults.conf;
    },

    read: function() {
        var customConfig = this.getConfigFromFile(this._configPath),
            config = _.defaultsDeep(this._options, customConfig, defaults);

        if (config.prepareEnvironment) {
            config.prepareEnvironment();
        }

        config.browsers = this._filterBrowsers(config.browsers);

        _.forEach(config.browsers, function(opts) {
            opts.sessionsPerBrowser = opts.sessionsPerBrowser || config.sessionsPerBrowser;
            opts.retry = opts.retry || config.retry;
        });

        config.mochaOpts.grep = config.grep;

        return config;
    },

    _filterBrowsers: function(configBrowsers) {
        var skipBrowsers = this._getBrowsersToSkip();

        validateUnknownBrowsers(skipBrowsers, _.keys(configBrowsers));

        return _.omit(configBrowsers, function(capabilities, name) {
            return _.includes(skipBrowsers, name);
        });
    },

    _getBrowsersToSkip: function() {
        var browsers = process.env.HERMIONE_SKIP_BROWSERS;

        return browsers ? browsers.split(/, */) : [];
    },

    getConfigFromFile: function(configPath) {
        try {
            return require(path.resolve(process.cwd(), configPath));
        } catch (e) {
            logger.error('Unable to read config from path ' + configPath);
            throw e;
        }
    }
});
