'use strict';

const program = require('commander');
const q = require('q');

const defaults = require('../config/defaults');
const info = require('./info');
const Hermione = require('../hermione');
const pkg = require('../../package.json');
const logger = require('../utils').logger;

process.on('uncaughtException', (err) => {
    logger.error(err.stack);
    process.exit(1);
});

exports.run = () => {
    program
        .version(pkg.version)
        .on('--help', () => logger.log(info.configOverriding))
        .option('-c, --config <path>', 'path to configuration file')
        .option('-r, --reporter <reporter>', 'test reporters', collect)
        .option('-b, --browser <browser>', 'run tests only in specified browser', collect)
        .option('-s, --set <set>', 'run tests only in the specified set', collect)
        .option('--grep <grep>', 'run only tests matching the pattern')
        .allowUnknownOption()
        .arguments('[paths...]')
        .parse(process.argv);

    return runHermione();
};

function collect(newValue, array) {
    return (array || []).concat(newValue);
}

function runHermione() {
    return q.try(() => Hermione.create(program.config || defaults.config, {cli: true, env: true}))
        .then((hermione) => {
            return hermione.run(program.args, {
                reporters: program.reporter || defaults.reporters,
                browsers: program.browser,
                sets: program.set,
                grep: program.grep
            });
        })
        .then((success) => process.exit(success ? 0 : 1))
        .catch((err) => {
            logger.error(err.stack || err);
            process.exit(1);
        });
}
