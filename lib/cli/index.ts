import { Command } from '@gemini-testing/commander';

import * as info from './info';
import defaults from '../config/defaults';
import Hermione from '../hermione';
import * as logger from '../utils/logger';
import pkg from '../../package.json';

process.on('uncaughtException', (err) => {
    logger.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, p) => {
    logger.error('Unhandled Rejection:\nPromise: ', p, '\nReason: ', reason);
});

export const run = () => {
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
        .option('--require <module>', 'require module', collect)
        .option('--grep <grep>', 'run only tests matching the pattern')
        .option('--update-refs', 'update screenshot references or gather them if they do not exist ("assertView" command)')
        .option('--inspect [inspect]', 'nodejs inspector on [=[host:]port]')
        .option('--inspect-brk [inspect-brk]', 'nodejs inspector with break at the start')
        .arguments('[paths...]')
        .action(async (paths: Array<string>) => {
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
            } catch (err: any) {
                logger.error(err.stack || err);
                process.exit(1);
            }
        });

    hermione.extendCli(program);

    program.parse(process.argv);
};

function collect<T>(newValue: T, array: Array<T> = []): Array<T> {
    return array.concat(newValue);
}

function preparseOption<T extends Command, K extends keyof T>(program: T, option: K): T[K] {
    // do not display any help, do not exit
    const configFileParser = Object.create(program) as T;
    configFileParser.options = [].concat(program.options);
    configFileParser.option('-h, --help');

    configFileParser.parse(process.argv);
    return configFileParser[option];
}

function handleRequires(requires: Array<string> = []): void {
    requires.forEach((module) => require(module));
}
