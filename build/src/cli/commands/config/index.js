"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCmd = void 0;
const constants_1 = require("../../constants");
const logger_1 = __importDefault(require("../../../utils/logger"));
const { CONFIG: commandName } = constants_1.CliCommands;
const registerCmd = (cliTool, testplane) => {
    cliTool
        .command(commandName)
        .description("Outputs Testplane config (including default and overriden by environment variables values)")
        .option("-c, --config <path>", "path to configuration file")
        .option("--space <count>", "white spaces count to insert into the JSON output", Number, 0)
        .action(async (options) => {
        const { space } = options;
        try {
            console.info(JSON.stringify(testplane.config, null, space));
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