"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCmd = void 0;
const node_path_1 = __importDefault(require("node:path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const test_collection_1 = require("../../../test-collection");
const constants_1 = require("../../constants");
const cli_1 = require("../../../utils/cli");
const logger_1 = __importDefault(require("../../../utils/logger"));
const { LIST_TESTS: commandName } = constants_1.CliCommands;
const registerCmd = (cliTool, testplane) => {
    (0, cli_1.withCommonCliOptions)({ cmd: cliTool.command(`${commandName}`), actionName: "list" })
        .description("Lists all tests info in one of available formats")
        .option("--ignore <file-path>", "exclude paths from tests read", cli_1.collectCliValues)
        .option("--silent [type]", "flag to disable events emitting while reading tests", Boolean, false)
        .option("--output-file <file-path>", "save results to specified file")
        .option("--formatter [name]", "return tests in specified format", String, test_collection_1.Formatters.LIST)
        .arguments("[paths...]")
        .action(async (paths, options) => {
        const { grep, browser: browsers, set: sets, require: requireModules } = cliTool;
        const { ignore, silent, outputFile, formatter } = options;
        try {
            (0, test_collection_1.validateFormatter)(formatter);
            (0, cli_1.handleRequires)(requireModules);
            const testCollection = await testplane.readTests(paths, {
                browsers,
                sets,
                grep,
                ignore,
                silent,
                runnableOpts: {
                    saveLocations: formatter === test_collection_1.Formatters.TREE,
                },
            });
            const result = testCollection.format(formatter);
            if (outputFile) {
                await fs_extra_1.default.ensureDir(node_path_1.default.dirname(outputFile));
                await fs_extra_1.default.writeJson(outputFile, result);
            }
            else {
                console.info(JSON.stringify(result));
            }
            process.exit(0);
        }
        catch (err) {
            logger_1.default.error(err.stack || err);
            process.exit(1);
        }
    });
};
exports.registerCmd = registerCmd;
//# sourceMappingURL=index.js.map