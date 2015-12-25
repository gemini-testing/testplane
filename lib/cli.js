'use strict';

var _ = require('lodash'),
    fs = require('fs'),
    ConfigReader = require('./config-reader'),
    URI = require('urijs'),
    validUrl = require('valid-url'),
    commander = require('commander'),
    chalk = require('chalk'),
    E2ERunner = require('./e2e-runner'),

    defaults = {
        baseUrl: 'http://localhost',
        conf: './e2e.conf.js',
        grid: 'http://localhost:4444/wd/hub',
        waitTimeout: 10000,
        screenshotPath: 'artifacts',
        slow: 10000,
        timeout: 60000,
        debug: false
    },
    helpMessages = {
        grid: _.template('URL селениум grid [${grid}]')(defaults),
        baseUrl: _.template('Базовый URL беты [${baseUrl}]')(defaults),
        timeout: _.template('Таймаут на выполнение теста [${timeout}]')(defaults),
        waitTimeout: _.template('Время ожидания событий на странице [${waitTimeout}]')(defaults),
        screenshotPath: _.template('Путь для хранения скриншотов [${screenshotPath}]')(defaults),
        slow: _.template('Время, после которого тест считается медленным [${slow}]')(defaults),
        debug: _.template('Включить дебаг webdriver [${debug}]')(defaults),
        conf: _.template('Запуск E2E тестов с конфигерацией [${conf}]')(defaults)
    },
    coercion = {
        grid: function(val) {
            var uri = new URI(val);
            if (!uri.scheme()) {
                uri.scheme('http');
            }
            return uri.toString();
        }
    };

exports.run = function() {
    var config = {};
    commander
        .command('<conf>', helpMessages.conf)
        .option('--baseUrl <url>', helpMessages.baseUrl, defaults.baseUrl)
        .option('--grid <url>', helpMessages.grid, defaults.grid, coercion.grid)
        .option('--timeout <ms>', helpMessages.timeout, defaults.timeout)
        .option('--wait-timeout <ms>', helpMessages.waitTimeout, defaults.waitTimeout)
        .option('--screenshot-path <path>', helpMessages.screenshotPath, defaults.screenshotPath)
        .option('--slow <ms>', helpMessages.slow, defaults.slow)
        .option('--debug <boolean>', helpMessages.debug, defaults.debug)
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

            var config = new ConfigReader(conf, opts).read(),
                e2eRunner = new E2ERunner(config);

            logRunData(config);
            return e2eRunner.run();
        });

    commander.parse(process.argv);
    return config;
};

function checkOptions(conf, opts) {
    if (!conf || !fs.existsSync(conf)) {
        throw new Error('Не найден config e2e-тестов ' + conf + ', задайте путь к конфигу --conf [path]');
    }

    if (opts.grid !== 'localhost' && !validUrl.isUri(opts.grid)) {
        throw new Error('Невалидный URL grid-а ' + opts.grid);
    }
}

function logRunData(config) {
    console.log(chalk.green('==================================================='));
    console.log(chalk.green('Запускаем E2E тесты ...'));
    console.log('  specs:', config.specs);
    console.log('  reporter: %s', config.reporter || 'flat');
    console.log('  grid: %s', config.grid);
    console.log('  browsers: %j', config.browsers);
    console.log('  url: %s', config.baseUrl);
    console.log('  waitTimeout: %s', config.waitTimeout);
}
