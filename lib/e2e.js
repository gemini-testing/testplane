var _ = require('lodash'),
    fs = require('fs'),
    ConfigReader = require('./configReader'),


    helps = {
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
            default: defaults.conf,
            help: helps.conf
        })
        .option('reporter', {
            default: defaults.reporter,
            help: helps.reporter
        })
        .option('grid', {
            default: defaults.grid,
            help: helps.grid
        })
        .option('baseUrl', {
            default: defaults.baseUrl,
            help: helps.baseUrl
        })
        .option('timeout', {
            default: defaults.timeout,
            help: helps.timeout
        })
        .option('timeout', {
            default: defaults.timeout,
            help: helps.timeout
        })
        .option('waitTimeout', {
            default: defaults.waitTimeout,
            help: helps.waitTimeout
        })
        .option('screenshotPath', {
            default: defaults.screenshotPath,
            help: helps.screenshotPath
        })
        .option('slow', {
            default: defaults.slow,
            help: helps.slow
        })
        .option('debug', {
            default: defaults.debug,
            help: helps.debug
        })
        .parse();


    if (!options.conf || !fs.existsSync(options.conf)) {
        throw new Error('Не найден config e2e-тестов ' + options.conf + ' задайте путь к конфигу --conf [path]');
    }

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
