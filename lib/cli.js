'use strict';

var _ = require('lodash'),
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
        conf: _.template('Запуск E2E тестов с конфигурацией [${conf}]')(defaults),
        browser: 'Запуск тестов в определенном браузере',
        retries: _.template('Количество перезапусков теста в случае ошибки [${retries}]')(defaults)
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
        .option('--timeout <ms>', helpMessages.timeout)
        .option('--wait-timeout <ms>', helpMessages.waitTimeout)
        .option('--screenshot-path <path>', helpMessages.screenshotPath)
        .option('--slow <ms>', helpMessages.slow)
        .option('--debug <boolean>', helpMessages.debug)
        .option('-r, --reporter <reporter>', helpMessages.reporters, coercion.collect)
        .option('-b, --browser <browser>', helpMessages.browser, coercion.collect)
        .option('--retries <int>', helpMessages.retries)
        .allowUnknownOption()
        .on('--help', function() {
            console.log(chalk.bold('Пример: '));
            console.log('');
            console.log(chalk.green('$ e2e --baseUrl http://yandex.ru/search'));
            console.log('');

            console.log(chalk.bold('Информация о E2E: '));
            console.log(chalk.green('   https://wiki.yandex-team.ru/search-interfaces/multimedia/test/e2e-wd/intro/'));
        });

    commander.parse(process.argv);
    commander.reporters = commander.reporter;
    var config = new ConfigReader(commander).read();

    logRunData(config);
    return new E2ERunner(config).run(commander.args, commander.browser);
};

// TODO логироваль все параметры, включая кастомные
function logRunData(config) {
    console.log(chalk.green('==================================================='));
    console.log(chalk.green('Запускаем E2E тесты ...'));
    console.log('  reporters: %s', config.reporters.join(', '));
    console.log('  grid: %s', config.grid);
    console.log('  baseUrl: %s', config.baseUrl);
    console.log('  waitTimeout: %s', config.waitTimeout);
}
