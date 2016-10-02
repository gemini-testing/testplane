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
        grid: _.template('Selenium grid URL [${grid}]')(defaults),
        baseUrl: _.template('Page under test base URL [${baseUrl}]')(defaults),
        waitTimeout: _.template('Default timeout for all `waitXXX` commands [${waitTimeout}ms]')(defaults),
        screenshotPath: _.template('Screenshot save path [${screenshotPath}]')(defaults),
        reporters: _.template('Reporters [${reporters}]')(defaults),
        debug: _.template('Enable debug output [${debug}]')(defaults),
        conf: _.template('Config path [${conf}]')(defaults),
        browser: 'Run tests in specific browser',
        grep: 'Filter tests matching string or regexp'
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
        .option('--grep <grep>', helpMessages.grep)
        .allowUnknownOption()
        .on('--help', function() {
            logger.log(chalk.bold('Example: \n'));
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

function logRunData(config) {
    logger.log(chalk.green('==================================================='));
    logger.log(chalk.green('Launching tests ...'));
    logger.log('  reporters: %s', config.reporters.join(', '));
    logger.log('  grid: %s', config.grid);
    logger.log('  baseUrl: %s', config.baseUrl);
    logger.log('  waitTimeout: %s', config.waitTimeout);
}
