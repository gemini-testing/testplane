var inherit = require('inherit'),
    _ = require('lodash'),
    shell = require('shelljs'),
    path = require('path'),
    isFile = require('is-file');

/**
 * Загружает конфиг и мержит с аргументами
 */
module.exports = inherit({
    __constructor: function(configPath, options) {
        this.configPath = configPath;
        this.options = options;
    },

    read: function() {
        var customConfig = require(path.join(process.cwd(), this.configPath));
        var config = _.defaults(this.options, customConfig);

        //Парсим файлы с тестами и сохраняем в options в виде массива
        // specs берутся из кастомного конфига
        config.tests = _.chain(config.specs).map(function(path) {
            if (isFile.sync(path)) {
                return path;
            }
            return shell.find(path).filter(function(file) {
                return file.match(/\.js$/);
            });
        }).flatten().value();

        return config;
    }
});
