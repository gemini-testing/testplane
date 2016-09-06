'use strict';

const chalk = require('chalk');
const commander = require('commander');
const _ = require('lodash');
const q = require('q');

const Config = require('./config');
const Hermione = require('./hermione');
const logger = require('./utils').logger;
const validateBrowsers = require('./config/validators').validateBrowsers;

const collect = (newValue, array) => (array || []).concat(newValue);

exports.run = () => {
    commander
        .option('-c, --conf <path>', 'config file')
        .option('-r, --reporter <reporter>', 'test reporter', collect)
        .option('-b, --browser <browser>', 'run tests only in specified browser', collect)
        .option('--grep <grep>', 'run only tests matching string or regexp')
        .allowUnknownOption()
        .on('--help', () => {
            console.log('  Overriding config');
            console.log('    To override any config option use full option path converted to --kebab-case');
            console.log('');

            console.log('    Examples:');
            console.log('      hermione --debug true');
            console.log('      hermione --base-url http://example.com');
            console.log('      hermione --browsers-firefox-sessions-per-browser 10');
            console.log('');
            console.log('    You can also use environment variables converted to snake_case with');
            console.log('    hermione_ prefix');
            console.log('');
            console.log('    Examples:');
            console.log('      hermione_debug=true hermione');
            console.log('      hermione_base_url=http://example.com hermione');
            console.log('      hermione_browsers-firefox-sessions-per-browser 10 hermione');
            console.log('');
            console.log('    If both cli flag and env var are used, cli flag takes precedence') ;
        });

    commander.parse(process.argv);

    return q.try(() => {
        let cliConfig = {
            conf: commander.conf,
            reporters: commander.reporter
        };

        if (commander.grep) {
            _.set(cliConfig, 'mochaOpts.grep', commander.grep);
        }

        const config = Config.create(cliConfig, {cli: true, env: true}).parse();

        validateBrowsers(config.browsers);

        logRunData(config);

        return new Hermione(config).run(commander.args, commander.browser);
    })
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
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
