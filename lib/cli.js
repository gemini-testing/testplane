'use strict';

var _ = require('lodash'),
    fs = require('fs'),
    ConfigReader = require('./config-reader'),
    URI = require('urijs'),
    commander = require('commander'),
    chalk = require('chalk'),
    E2ERunner = require('./e2e-runner'),

    defaults = require('./defaults'),
    helpMessages = {
        grid: _.template('URL селениум grid [${grid}]')(defaults),
        baseUrl: _.template('Базовый URL беты [${baseUrl}]')(defaults),
        timeout: _.template('Таймаут на выполнение теста [${timeout}]')(defaults),
        waitTimeout: _.template('Время ожидания событий на странице [${waitTimeout}]')(defaults),
        screenshotPath: _.template('Путь для хранения скриншотов [${screenshotPath}]')(defaults),
        slow: _.template('Время, после которого тест считается медленным [${slow}]')(defaults),
        reporters: _.template('Используемые репортеры [${reporters}]')(defaults),
        debug: _.template('Включить дебаг webdriver [${debug}]')(defaults),
        conf: _.template('Запуск E2E тестов с конфигурацией [${conf}]')(defaults)
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
    var config = {};
    commander
        .command('<conf>', helpMessages.conf)
        .option('--baseUrl <url>', helpMessages.baseUrl)
        .option('--grid <url>', helpMessages.grid, coercion.grid)
        .option('--timeout <ms>', helpMessages.timeout)
        .option('--wait-timeout <ms>', helpMessages.waitTimeout)
        .option('--screenshot-path <path>', helpMessages.screenshotPath)
        .option('--slow <ms>', helpMessages.slow)
        .option('--debug <boolean>', helpMessages.debug)
        .option('-r, --reporter <reporter>', helpMessages.reporters, coercion.collect)
        .on('--help', function() {
            console.log(chalk.bold('Пример: '));
            console.log('');
            console.log(chalk.green('$ e2e ./myConf.js --baseUrl http://yandex.ru/search'));
            console.log('');

            console.log(chalk.bold('Информация о E2E: '));
            console.log(chalk.green('   https://wiki.yandex-team.ru/search-interfaces/multimedia/test/e2e-wd/intro/'));
        })
        .action(function(conf, opts) {
            checkOptions(conf, opts);
            config = new ConfigReader(conf, opts).read();
        });

    commander.parse(process.argv);
    logRunData(config);
    new E2ERunner(config).run();
};

function checkOptions(conf, opts) {
    if (!conf || !fs.existsSync(conf)) {
        throw new Error('Не найден config e2e-тестов ' + conf + ', задайте относительный путь к конфигу');
    }
}

// TODO логироваль все параметры, включая кастомные
function logRunData(config) {
    console.log(chalk.green('==================================================='));
    console.log(chalk.green('Запускаем E2E тесты ...'));
    console.log('  specs:', config.specs);
    console.log('  reporters: %s', config.reporters.join(', '));
    console.log('  grid: %s', config.grid);
    console.log('  browsers: %j', config.browsers);
    console.log('  url: %s', config.baseUrl);
    console.log('  waitTimeout: %s', config.waitTimeout);
}
