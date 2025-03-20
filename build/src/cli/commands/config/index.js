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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCmd = void 0;
const constants_1 = require("../../constants");
const logger = __importStar(require("../../../utils/logger"));
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
            logger.error(err.stack || err);
            process.exit(1);
        }
    });
};
exports.registerCmd = registerCmd;
//# sourceMappingURL=index.js.map