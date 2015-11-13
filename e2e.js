var _ = require('lodash'),
    templates = {
        reporter: _.template('Репортер mocha [${reporter}]'),
        grid: _.template('URL селениум grid [${localGridUrl}]'),
        browser: _.template('Браузер [${browser}]'),
        url: _.template('Ссылка на host с тестируемой бетой [${url}]'),
        remoteGrid: _.template('Использовать selenium grid в облаке?'),
        concat: _.template('Собрать тесты в один файл перед запуском [${concat}]'),
        timeout: _.template('Время на выполнения теста [${timeout}]'),
        waitTimeout: _.template('Время ожидания событий [${waitTimeout}]'),
        sreenshotPath: _.template('Место хранения скриншотов [${screenthotPath}]'),
        slow: _.template('Время, после которого тест считается медленным [${slow}]'),
        debug: _.template('Включить дебаг webdriver [${debug}]')
    },
    defaults = {
        reporter: 'spec',
        browser: 'desktop-firefox',
        url: 'http://localhost:8080/',
        path: '',
        localGridUrl: 'http://localhost:4444/wd/hub',
        remoteGridUrl: 'http://selenium:selenium@sg.yandex-team.ru:4444/wd/hub',
        waitTimeout: 10000,
        screenshotPath: 'artifacts'
    };

exports.cli = function(program) {
    program
        .command('e2e [path...]')
        .description('Запустить E2E тесты на mocha & webdriver.io')
        // TODO multi-reporter + allure
        .option('--reporter [reporter]', templates.reporter(defaults), defaults.reporter)
        .option('--grid [hostname]', templates.grid(defaults))
        .option('--browser [browser]', templates.browser(defaults), defaults.browser)
        .option('--url [url]', templates.url(defaults), defaults.url)
        .option('--remote-grid', templates.remoteGrid(), false)
        .option('--timeout', templates.timeout, 60000)
        .option('--wait-timeout', templates.waitTimeout(), defaults.waitTimeout)
        .option('--screenshot-path', templates.sreenshotPath(), defaults.screenshotPath)
        .option('--concat', templates.concat(), false)
        .option('--slow', templates.concat(), 10000)

        .action(function(path, options) {
            if(!path.length) {
                path = defaults.path;
            }

            options.path = path;

            if(_.isEmpty(options.grid)) {
                options.grid = options.remoteGrid ? defaults.remoteGridUrl : defaults.localGridUrl;
            }

            console.log('Запускаем E2E тесты ...');
            console.log('  path:', path);
            console.log('  reporter: %s', options.reporter);
            console.log('  grid: %s', options.grid);
            console.log('  browser: %s', options.browser);
            console.log('  url: %s', options.url);
            console.log('  concat: %s', options.concat);

            return options;
        });
};

exports.runDataProvider = require('./runDataProvider');
exports.mochaRun = require('./lib/mochaRun');
