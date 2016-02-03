'use strict';

var inherit = require('inherit'),
    _ = require('lodash'),
    path = require('path'),
    defaults = require('./defaults'),
    logger = require('./utils').logger;

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

        _.forEach(config.browsers, function(opts) {
            opts.sessionsPerBrowser = opts.sessionsPerBrowser || config.sessionsPerBrowser;
            opts.retry = opts.retry || config.retry;
        });

        return config;
    },

    getConfigFromFile: function(configPath) {
        try {
            return require(path.join(process.cwd(), configPath));
        } catch (e) {
            logger.error('Unable to read config from path ' + configPath);
            throw e;
        }
    }
});
