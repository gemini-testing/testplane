import util from "util";
import { Command } from "@gemini-testing/commander";
import escapeRe from "escape-string-regexp";

import defaults from "../config/defaults";
import { configOverriding } from "./info";
import { Testplane } from "../testplane";
import pkg from "../../package.json";
import logger from "../utils/logger";
import { requireModule } from "../utils/module";
import { shouldIgnoreUnhandledRejection } from "../utils/errors";

export type TestplaneRunOpts = { cliName?: string };

let testplane: Testplane;

process.on("uncaughtException", err => {
    logger.error(util.inspect(err));
    process.exit(1);
});

process.on("unhandledRejection", (reason, p) => {
    if (shouldIgnoreUnhandledRejection(reason as Error)) {
        logger.warn(`Unhandled Rejection "${reason}" in testplane:master:${process.pid} was ignored`);
        return;
    }

    const error = [
        `Unhandled Rejection in testplane:master:${process.pid}:`,
        `Promise: ${util.inspect(p)}`,
        `Reason: ${util.inspect(reason)}`,
    ].join("\n");

    if (testplane) {
        testplane.halt(new Error(error));
    } else {
        logger.error(error);
        process.exit(1);
    }
});

export const run = (opts: TestplaneRunOpts = {}): void => {
    const program = new Command(opts.cliName || "testplane");

    program.version(pkg.version).allowUnknownOption().option("-c, --config <path>", "path to configuration file");

    const configPath = preparseOption(program, "config") as string;
    testplane = Testplane.create(configPath);

    program
        .on("--help", () => logger.log(configOverriding(opts)))
        .option("-b, --browser <browser>", "run tests only in specified browser", collect)
        .option("-s, --set <set>", "run tests only in the specified set", collect)
        .option("-r, --require <module>", "require module", collect)
        .option("--reporter <reporter>", "test reporters", collect)
        .option("--grep <grep>", "run only tests matching the pattern", compileGrep)
        .option(
            "--update-refs",
            'update screenshot references or gather them if they do not exist ("assertView" command)',
        )
        .option("--inspect [inspect]", "nodejs inspector on [=[host:]port]")
        .option("--inspect-brk [inspect-brk]", "nodejs inspector with break at the start")
        .option(
            "--repl [type]",
            "run one test, call `browser.switchToRepl` in test code to open repl interface",
            Boolean,
            false,
        )
        .option("--repl-before-test [type]", "open repl interface before test run", Boolean, false)
        .option("--repl-on-fail [type]", "open repl interface on test fail only", Boolean, false)
        .option("--devtools", "switches the browser to the devtools mode with using CDP protocol")
        .arguments("[paths...]")
        .action(async (paths: string[]) => {
            try {
                const {
                    reporter: reporters,
                    browser: browsers,
                    set: sets,
                    grep,
                    updateRefs,
                    require: requireModules,
                    inspect,
                    inspectBrk,
                    repl,
                    replBeforeTest,
                    replOnFail,
                    devtools,
                } = program;

                await handleRequires(requireModules);

                const isTestsSuccess = await testplane.run(paths, {
                    reporters: reporters || defaults.reporters,
                    browsers,
                    sets,
                    grep,
                    updateRefs,
                    requireModules,
                    inspectMode: (inspect || inspectBrk) && { inspect, inspectBrk },
                    replMode: {
                        enabled: repl || replBeforeTest || replOnFail,
                        beforeTest: replBeforeTest,
                        onFail: replOnFail,
                    },
                    devtools: devtools || false,
                });

                process.exit(isTestsSuccess ? 0 : 1);
            } catch (err) {
                logger.error((err as Error).stack || err);
                process.exit(1);
            }
        });

    testplane.extendCli(program);

    program.parse(process.argv);
};

function collect(newValue: string | string[], array: string[] = []): string[] {
    return array.concat(newValue);
}

function preparseOption(program: Command, option: string): unknown {
    // do not display any help, do not exit
    const configFileParser = Object.create(program);
    configFileParser.options = [].concat(program.options);
    configFileParser.option("-h, --help");

    configFileParser.parse(process.argv);
    return configFileParser[option];
}

function compileGrep(grep: string): RegExp {
    try {
        return new RegExp(`(${grep})|(${escapeRe(grep)})`);
    } catch (error) {
        logger.warn(`Invalid regexp provided to grep, searching by its string representation. ${error}`);
        return new RegExp(escapeRe(grep));
    }
}

async function handleRequires(requires: string[] = []): Promise<void> {
    for (const modulePath of requires) {
        await requireModule(modulePath);
    }
}
