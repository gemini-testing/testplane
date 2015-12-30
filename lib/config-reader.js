'use strict';

var inherit = require('inherit'),
    _ = require('lodash'),
    shell = require('shelljs'),
    path = require('path'),
    isFile = require('is-file'),
    defaults = require('./defaults');

/**
 * Загружает конфиг и мержит с аргументами
 */
module.exports = inherit({
    __constructor: function(configPath, options) {
        this.configPath = configPath;
        this.options = options;
    },

    read: function() {
        var customConfig = this.getConfigFromFile(this.configPath);
        var config = _.defaults(this.options, customConfig, defaults);
        if (config.prepareEnvironment) {
            config.prepareEnvironment();
        }

        // Находим файлы с тестами и сохраняем в options в виде массива
        // specs берутся из кастомного конфига
        config.tests = _.chain(config.specs).map(function(specPath) {
            if (isFile.sync(specPath)) {
                return specPath;
            }
            return shell.find(specPath).filter(function(file) {
                return file.match(/\.js$/);
            });
        }).flatten().value();

        _.forEach(config.browsers, function(opts) {
            opts.sessionsPerBrowser = opts.sessionsPerBrowser || config.sessionsPerBrowser;
        });

        return config;
    },

    getConfigFromFile: function(configPath) {
        return require(path.join(process.cwd(), configPath));
    }
});
