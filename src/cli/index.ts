import path from "node:path";
import { Command } from "@gemini-testing/commander";
import getPort from "get-port";

import defaults from "../config/defaults";
import { configOverriding } from "./info";
import { Testplane } from "../testplane";
import pkg from "../../package.json";
import * as logger from "../utils/logger";
import { shouldIgnoreUnhandledRejection } from "../utils/errors";
import { utilInspectSafe } from "../utils/secret-replacer";
import { withCommonCliOptions, collectCliValues, handleRequires } from "../utils/cli";
import { CliCommands } from "./constants";

export type TestplaneRunOpts = { cliName?: string };

let testplane: Testplane;

process.on("uncaughtException", err => {
    logger.error(utilInspectSafe(err));
    process.exit(1);
});

process.on("unhandledRejection", (reason, p) => {
    // This flag lets other unhandledRejection handlers know that we already processed it on Testplane side.
    // Currently we use this to avoid duplicate error logging and force shutdown in HTML Reporter.
    (global as Record<string, unknown>)["__TESTPLANE_INTERNAL_UNHANDLED_REJECTION_PROCESSED"] = true;
    if (shouldIgnoreUnhandledRejection(reason as Error)) {
        logger.warn(`Unhandled Rejection "${reason}" in testplane:master:${process.pid} was ignored`);
        return;
    }

    const error = [
        `Unhandled Rejection in testplane:master:${process.pid}:`,
        `Promise: ${utilInspectSafe(p)}`,
        `Reason: ${utilInspectSafe(reason)}`,
    ].join("\n");

    if (testplane) {
        testplane.halt(new Error(error));
    } else {
        logger.error(error);
        process.exit(1);
    }
});

export const run = async (opts: TestplaneRunOpts = {}): Promise<void> => {
    const program = new Command(opts.cliName || "testplane");

    program.version(pkg.version).allowUnknownOption().option("-c, --config <path>", "path to configuration file");

    const programToParseRequires = new Command(opts.cliName || "testplane")
        .version(pkg.version)
        .allowUnknownOption()
        .option("-r, --require <module>", "require module", collectCliValues);
    const requireModules = preparseOption(programToParseRequires, "require") as string[];
    if (requireModules) {
        await handleRequires(requireModules);
    }

    const configPath = preparseOption(program, "config") as string;
    testplane = Testplane.create(configPath);

    withCommonCliOptions({ cmd: program, actionName: "run" })
        .on("--help", () => console.log(configOverriding(opts)))
        .description("Run tests")
        .option("--reporter <name>", "test reporters", collectCliValues)
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
        .option(
            "--repl-port <number>",
            "run net server on port to exchange messages with repl (used free random port by default)",
            Number,
            0,
        )
        .option("--devtools", "switches the browser to the devtools mode with using CDP protocol")
        .option("--local", "use local browsers, managed by testplane (same as 'gridUrl': 'local')")
        .option("--keep-browser", "do not close browser session after test completion")
        .option("--keep-browser-on-fail", "do not close browser session when test fails")
        .arguments("[paths...]")
        .action(async (paths: string[]) => {
            try {
                const {
                    reporter: reporters,
                    browser: browsers,
                    set: sets,
                    grep,
                    tag,
                    updateRefs,
                    inspect,
                    inspectBrk,
                    replBeforeTest,
                    replOnFail,
                    devtools,
                    local,
                    keepBrowser,
                    keepBrowserOnFail,
                } = program;

                const isTestsSuccess = await testplane.run(paths, {
                    reporters: reporters || defaults.reporters,
                    browsers,
                    sets,
                    grep,
                    tag,
                    updateRefs,
                    requireModules,
                    inspectMode: (inspect || inspectBrk) && { inspect, inspectBrk },
                    replMode: {
                        enabled: isReplModeEnabled(program),
                        beforeTest: replBeforeTest,
                        onFail: replOnFail,
                        port: await getReplPort(program),
                    },
                    devtools: devtools || false,
                    local: local || false,
                    keepBrowserMode: {
                        enabled: keepBrowser || keepBrowserOnFail || false,
                        onFail: keepBrowserOnFail || false,
                    },
                });

                process.exit(isTestsSuccess ? 0 : 1);
            } catch (err) {
                logger.error((err as Error).stack || err);
                process.exit(1);
            }
        });

    for (const commandName of Object.values(CliCommands)) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { registerCmd } = require(path.resolve(__dirname, "./commands", commandName));

        registerCmd(program, testplane);
    }

    testplane.extendCli(program);

    program.parse(process.argv);
};

function preparseOption(program: Command, option: string): unknown {
    // do not display any help, do not exit
    const configFileParser = Object.create(program);
    configFileParser.options = [].concat(program.options);
    configFileParser.option("-h, --help");

    configFileParser.parse(process.argv);
    return configFileParser[option];
}

function isReplModeEnabled(program: Command): boolean {
    const { repl, replBeforeTest, replOnFail } = program;

    return repl || replBeforeTest || replOnFail;
}

async function getReplPort(program: Command): Promise<number> {
    let { replPort } = program;

    if (isReplModeEnabled(program) && !replPort) {
        replPort = await getPort();
    }

    return replPort;
}
