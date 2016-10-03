'use strict';

const chalk = require('chalk');
const commander = require('commander');
const q = require('q');

const Config = require('./config');
const Hermione = require('./hermione');
const logger = require('./utils').logger;
const validateEmptyBrowsers = require('./validators').validateEmptyBrowsers;

const overridingInfo =
`  Overriding config
    To override any config option use full option path converted to --kebab-case

    Examples:
      hermione --debug true
      hermione --base-url http://example.com
      hermione --browsers-firefox-sessions-per-browser 10

    You can also use environment variables converted to snake_case with
    hermione_ prefix

    Examples:
      hermione_debug=true hermione
      hermione_base_url=http://example.com hermione
      hermione_browsers_firefox_sessions_per_browser 10 hermione

    If both cli flag and env var are used, cli flag takes precedence
`;

const collect = (newValue, array) => (array || []).concat(newValue);

const initCliConfig = (commander) => {
    return {
        config: commander.config,
        reporters: commander.reporter,
        mochaOpts: {
            grep: commander.grep
        }
    };
};

const logRunData = (config) => {
    logger.log(chalk.green('==================================================='));
    logger.log(chalk.green('Launching tests ...'));
    logger.log(`  reporters: ${config.reporters.join(', ')}`);
    logger.log(`  gridUrl: ${config.gridUrl}`);
    logger.log(`  baseUrl: ${config.baseUrl}`);
    logger.log(`  waitTimeout: ${config.waitTimeout}`);
};

const runHermione = (commander) => {
    const cliConfig = initCliConfig(commander);
    const config = Config.create(cliConfig, {cli: true, env: true}).parse();

    validateEmptyBrowsers(config.browsers);

    logRunData(config);

    return new Hermione(config).run(commander.args, commander.browser);
};

exports.run = () => {
    commander
        .option('-c, --config <path>', 'path to configuration file')
        .option('-r, --reporter <reporter>', 'test reporters', collect)
        .option('-b, --browser <browser>', 'run tests only in specified browser', collect)
        .option('--grep <grep>', 'run only tests matching string or regexp')
        .allowUnknownOption()
        .on('--help', () => console.log(overridingInfo));

    commander.parse(process.argv);

    return q.try(() => runHermione(commander))
        .then((success) => process.exit(success ? 0 : 1))
        .catch((err) => {
            logger.error(err.stack || err);
            process.exit(1);
        });
};
