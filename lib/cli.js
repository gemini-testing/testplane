'use strict';

var _ = require('lodash'),
    Q = require('q'),
    ConfigReader = require('./config-reader'),
    URI = require('urijs'),
    commander = require('commander'),
    chalk = require('chalk'),
    Hermione = require('./hermione'),
    logger = require('./utils').logger,

    defaults = require('./defaults'),
    helpMessages = {
        grid: _.template('URL селениум grid [${grid}]')(defaults),
        baseUrl: _.template('Базовый URL беты [${baseUrl}]')(defaults),
        waitTimeout: _.template('Время ожидания событий на странице [${waitTimeout}]')(defaults),
        screenshotPath: _.template('Путь для хранения скриншотов [${screenshotPath}]')(defaults),
        reporters: _.template('Используемые репортеры [${reporters}]')(defaults),
        debug: _.template('Включить дебаг webdriver [${debug}]')(defaults),
        conf: _.template('Путь к конфигу [${conf}]')(defaults),
        browser: 'Запуск тестов в определенном браузере'
    },
    coercion = {
        grid: function(val) {
            var uri = new URI(val);
            if (!uri.scheme()) {
                uri.scheme('http');
            }
            return uri.toString();
        },
        collect: function(newValue, array) {
            array = array || [];
            return array.concat(newValue);
        }
    };

exports.run = function() {
    commander
        .option('-c, --conf <path>', helpMessages.conf)
        .option('--baseUrl <url>', helpMessages.baseUrl)
        .option('--grid <url>', helpMessages.grid, coercion.grid)
        .option('--wait-timeout <ms>', helpMessages.waitTimeout)
        .option('--screenshot-path <path>', helpMessages.screenshotPath)
        .option('--debug <boolean>', helpMessages.debug)
        .option('-r, --reporter <reporter>', helpMessages.reporters, coercion.collect)
        .option('-b, --browser <browser>', helpMessages.browser, coercion.collect)
        .allowUnknownOption()
        .on('--help', function() {
            logger.log(chalk.bold('Пример: \n'));
            logger.log(chalk.green('$ hermione --baseUrl http://yandex.ru/search\n'));
        });

    commander.parse(process.argv);
    commander.reporters = commander.reporter;

    return Q.try(function() {
            var config = new ConfigReader(commander).read();
            logRunData(config);
            return new Hermione(config).run(commander.args, commander.browser);
        })
        .then(function(success) {
            process.exit(success ? 0 : 1);
        })
        .catch(function(err) {
            logger.error(err.stack || err);
            process.exit(1);
        });
};

// TODO логироваль все параметры, включая кастомные
function logRunData(config) {
    logger.log(chalk.green('==================================================='));
    logger.log(chalk.green('Запускаем тесты ...'));
    logger.log('  reporters: %s', config.reporters.join(', '));
    logger.log('  grid: %s', config.grid);
    logger.log('  baseUrl: %s', config.baseUrl);
    logger.log('  waitTimeout: %s', config.waitTimeout);
}
