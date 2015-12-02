var _ = require('lodash'),
    fs = require('fs'),
    ConfigReader = require('./configReader'),
    URI = require('urijs'),
    validUrl = require('valid-url'),

    helpMessages = {
        reporter: 'Репортер mocha',
        grid: 'URL селениум grid',
        baseUrl: 'Ссылка на бету',
        timeout: 'Таймаут на выполнение теста',
        waitTimeout: 'Время ожидания событий на странице',
        screenshotPath: 'Путь для хранения скриншотов',
        slow: 'Время, после которого тест считается медленным',
        debug: 'Включить дебаг webdriver',
        conf: 'Путь до конфига e2e'
    },
    defaults = {
        reporter: 'spec',
        browsers: 'desktop-firefox',
        baseUrl: 'http://localhost',
        conf: './e2e.conf.js',
        grid: 'http://localhost:4444/wd/hub',
        waitTimeout: 10000,
        screenshotPath: 'artifacts',
        slow: 10000,
        timeout: 60000,
        debug: false
    };

exports.cli = function() {
    var options = require('nomnom')
        .script('test')
        .option('conf', {
            //default: defaults.conf,
            help: helpMessages.conf,
            required: true,
            callback: function(conf) {
                if (!conf || !fs.existsSync(conf)) {
                    return ('Не найден config e2e-тестов ' + conf + ' задайте путь к конфигу --conf [path]');
                }
            }
        })
        .option('reporter', {
            default: defaults.reporter,
            help: helpMessages.reporter
        })
        .option('grid', {
            default: defaults.grid,
            help: helpMessages.grid,
            transform: function(grid) {
                var uri = new URI(grid);
                if (!uri.scheme()) {
                    uri.scheme('http')
                }
                return uri.toString();
            },

            callback: function(grid) {
                if (grid !== 'localhost' && !validUrl.isUri(grid)) {
                    return 'Невалидный URL grid-а ' + grid;
                }
            }
        })
        .option('baseUrl', {
            default: defaults.baseUrl,
            help: helpMessages.baseUrl
        })
        .option('timeout', {
            default: defaults.timeout,
            help: helpMessages.timeout,
            type: 'integer'
        })
        .option('waitTimeout', {
            default: defaults.waitTimeout,
            help: helpMessages.waitTimeout
        })
        .option('screenshotPath', {
            default: defaults.screenshotPath,
            help: helpMessages.screenshotPath
        })
        .option('slow', {
            default: defaults.slow,
            help: helpMessages.slow
        })
        .option('debug', {
            default: defaults.debug,
            help: helpMessages.debug
        })
        .parse();

    console.log(options.grid);

    //Мержим опции из CLI c кастомными
    //Кастомные опции перетирают опции в CLI
    var config = new ConfigReader(options.conf, options).read();

    logRunData(config);

    return config;
};

function logRunData(config) {
    console.log('Запускаем E2E тесты ...');
    console.log('  specs:', config.specs);
    console.log('  reporter: %s', config.reporter);
    console.log('  grid: %s', config.grid);
    console.log('  browsers: %s', config.browsers);
    console.log('  url: %s', config.baseUrl);
    console.log('  waitTimeout: %s', config.waitTimeout);
}


exports.MochaRun = require('./mochaRun');
