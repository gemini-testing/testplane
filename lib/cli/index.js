'use strict';

const {Command} = require('commander');

const defaults = require('../config/defaults');
const info = require('./info');
const Hermione = require('../hermione');
const pkg = require('../../package.json');
const logger = require('../utils/logger');

process.on('uncaughtException', (err) => {
    logger.error(err.stack);
    process.exit(1);
});

exports.run = () => {
    const program = new Command();

    program
        .version(pkg.version)
        .allowUnknownOption()
        .option('-c, --config <path>', 'path to configuration file');

    const configPath = preparseOption(program, 'config');
    const hermione = Hermione.create(configPath);

    program
        .on('--help', () => logger.log(info.configOverriding))
        .option('-r, --reporter <reporter>', 'test reporters', collect)
        .option('-b, --browser <browser>', 'run tests only in specified browser', collect)
        .option('-s, --set <set>', 'run tests only in the specified set', collect)
        .option('--grep <grep>', 'run only tests matching the pattern')
        .arguments('[paths...]');

    hermione.extendCli(program);

    program.parse(process.argv);

    return hermione
        .run(program.args, {
            reporters: program.reporter || defaults.reporters,
            browsers: program.browser,
            sets: program.set,
            grep: program.grep
        })
        .then((success) => process.exit(success ? 0 : 1))
        .catch((err) => {
            logger.error(err.stack || err);
            process.exit(1);
        });
};

function collect(newValue, array = []) {
    return array.concat(newValue);
}

function preparseOption(program, option) {
    // do not display any help, do not exit
    const configFileParser = Object.create(program);
    configFileParser.options = [].concat(program.options);
    configFileParser.option('-h, --help');

    configFileParser.parse(process.argv);
    return configFileParser[option];
}
