"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCmd = void 0;
const node_path_1 = __importDefault(require("node:path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const constants_1 = require("../../../test-collection/constants");
const test_collection_1 = require("../../../test-collection");
const constants_2 = require("../../constants");
const cli_1 = require("../../../utils/cli");
const logger = __importStar(require("../../../utils/logger"));
const { LIST_TESTS: commandName } = constants_2.CliCommands;
const registerCmd = (cliTool, testplane) => {
    (0, cli_1.withCommonCliOptions)({ cmd: cliTool.command(`${commandName}`), actionName: "list" })
        .description("Lists all tests info in one of available formats")
        .option("--ignore <file-path>", "exclude paths from tests read", cli_1.collectCliValues)
        .option("--silent [type]", "flag to disable events emitting while reading tests", Boolean, false)
        .option("--output-file <file-path>", "save results to specified file")
        .option("--formatter [name]", "return tests in specified format", String, constants_1.Formatters.LIST)
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
                    saveLocations: formatter === constants_1.Formatters.TREE,
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
            logger.error(err.stack || err);
            process.exit(1);
        }
    });
};
exports.registerCmd = registerCmd;
//# sourceMappingURL=index.js.map