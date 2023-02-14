'use strict';

const {Command} = require('@gemini-testing/commander');
const escapeRe = require('escape-string-regexp');

const defaults = require('../config/defaults');
const info = require('./info');
const Hermione = require('../hermione');
const pkg = require('../../package.json');
const logger = require('../utils/logger');

process.on('uncaughtException', (err) => {
    logger.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, p) => {
    logger.error('Unhandled Rejection:\nPromise: ', p, '\nReason: ', reason);
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
        .option('-b, --browser <browser>', 'run tests only in specified browser', collect)
        .option('-s, --set <set>', 'run tests only in the specified set', collect)
        .option('-r, --require <module>', 'require module', collect)
        .option('--reporter <reporter>', 'test reporters', collect)
        .option('--grep <grep>', 'run only tests matching the pattern', compileGrep)
        .option('--update-refs', 'update screenshot references or gather them if they do not exist ("assertView" command)')
        .option('--inspect [inspect]', 'nodejs inspector on [=[host:]port]')
        .option('--inspect-brk [inspect-brk]', 'nodejs inspector with break at the start')
        .arguments('[paths...]')
        .action(async (paths) => {
            try {
                handleRequires(program.require);

                const isTestsSuccess = await hermione.run(paths, {
                    reporters: program.reporter || defaults.reporters,
                    browsers: program.browser,
                    sets: program.set,
                    grep: program.grep,
                    updateRefs: program.updateRefs,
                    requireModules: program.require,
                    inspectMode: (program.inspect || program.inspectBrk) && {
                        inspect: program.inspect,
                        inspectBrk: program.inspectBrk
                    }
                });

                process.exit(isTestsSuccess ? 0 : 1);
            } catch (err) {
                logger.error(err.stack || err);
                process.exit(1);
            }
        });

    hermione.extendCli(program);

    program.parse(process.argv);
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

function handleRequires(requires = []) {
    requires.forEach((module) => require(module));
}

function compileGrep(grep) {
    try {
        return new RegExp(`(${grep})|(${escapeRe(grep)})`);
    } catch (error) {
        logger.warn(`Invalid regexp provided to grep, searching by its string representation. ${error}`);
        return new RegExp(escapeRe(grep));
    }
}
