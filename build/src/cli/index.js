"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const node_path_1 = __importDefault(require("node:path"));
const commander_1 = require("@gemini-testing/commander");
const defaults_1 = __importDefault(require("../config/defaults"));
const info_1 = require("./info");
const testplane_1 = require("../testplane");
const package_json_1 = __importDefault(require("../../package.json"));
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
const secret_replacer_1 = require("../utils/secret-replacer");
const cli_1 = require("../utils/cli");
const constants_1 = require("./constants");
let testplane;
process.on("uncaughtException", err => {
    logger_1.default.error((0, secret_replacer_1.utilInspectSafe)(err));
    process.exit(1);
});
process.on("unhandledRejection", (reason, p) => {
    if ((0, errors_1.shouldIgnoreUnhandledRejection)(reason)) {
        logger_1.default.warn(`Unhandled Rejection "${reason}" in testplane:master:${process.pid} was ignored`);
        return;
    }
    const error = [
        `Unhandled Rejection in testplane:master:${process.pid}:`,
        `Promise: ${(0, secret_replacer_1.utilInspectSafe)(p)}`,
        `Reason: ${(0, secret_replacer_1.utilInspectSafe)(reason)}`,
    ].join("\n");
    if (testplane) {
        testplane.halt(new Error(error));
    }
    else {
        logger_1.default.error(error);
        process.exit(1);
    }
});
const run = (opts = {}) => {
    const program = new commander_1.Command(opts.cliName || "testplane");
    program.version(package_json_1.default.version).allowUnknownOption().option("-c, --config <path>", "path to configuration file");
    const configPath = preparseOption(program, "config");
    testplane = testplane_1.Testplane.create(configPath);
    (0, cli_1.withCommonCliOptions)({ cmd: program, actionName: "run" })
        .on("--help", () => console.log((0, info_1.configOverriding)(opts)))
        .description("Run tests")
        .option("--reporter <name>", "test reporters", cli_1.collectCliValues)
        .option("--update-refs", 'update screenshot references or gather them if they do not exist ("assertView" command)')
        .option("--inspect [inspect]", "nodejs inspector on [=[host:]port]")
        .option("--inspect-brk [inspect-brk]", "nodejs inspector with break at the start")
        .option("--repl [type]", "run one test, call `browser.switchToRepl` in test code to open repl interface", Boolean, false)
        .option("--repl-before-test [type]", "open repl interface before test run", Boolean, false)
        .option("--repl-on-fail [type]", "open repl interface on test fail only", Boolean, false)
        .option("--devtools", "switches the browser to the devtools mode with using CDP protocol")
        .option("--local", "use local browsers, managed by testplane (same as 'gridUrl': 'local')")
        .arguments("[paths...]")
        .action(async (paths) => {
        try {
            const { reporter: reporters, browser: browsers, set: sets, grep, updateRefs, require: requireModules, inspect, inspectBrk, repl, replBeforeTest, replOnFail, devtools, local, } = program;
            await (0, cli_1.handleRequires)(requireModules);
            const isTestsSuccess = await testplane.run(paths, {
                reporters: reporters || defaults_1.default.reporters,
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
                local: local || false,
            });
            process.exit(isTestsSuccess ? 0 : 1);
        }
        catch (err) {
            logger_1.default.error(err.stack || err);
            process.exit(1);
        }
    });
    for (const commandName of Object.values(constants_1.CliCommands)) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { registerCmd } = require(node_path_1.default.resolve(__dirname, "./commands", commandName));
        registerCmd(program, testplane);
    }
    testplane.extendCli(program);
    program.parse(process.argv);
};
exports.run = run;
function preparseOption(program, option) {
    // do not display any help, do not exit
    const configFileParser = Object.create(program);
    configFileParser.options = [].concat(program.options);
    configFileParser.option("-h, --help");
    configFileParser.parse(process.argv);
    return configFileParser[option];
}
//# sourceMappingURL=index.js.map