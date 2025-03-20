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
const lodash_1 = __importDefault(require("lodash"));
const constants_1 = require("../../constants");
const logger = __importStar(require("../../../utils/logger"));
const { LIST_BROWSERS: commandName } = constants_1.CliCommands;
const BrowsersListOutputType = {
    IDS: "ids",
    TAGS: "tags",
};
const BrowsersListOutputFormat = {
    JSON: "json",
    PLAIN: "plain",
};
const validateOption = (availableOptions, value, optionName) => {
    const optionsArray = Object.values(availableOptions);
    if (!optionsArray.includes(value)) {
        const optionsList = optionsArray.map(value => `"${value}"`).join(", ");
        throw new Error(`"${optionName}" option must be one of: ${optionsList}, but got "${value}"`);
    }
};
const extractBrowserIds = (testplaneConfig) => {
    const browsersArray = Object.keys(testplaneConfig.browsers);
    return lodash_1.default.uniq(browsersArray).filter(Boolean).sort();
};
const extractBrowserTags = (testplaneConfig, format) => {
    const browserConfigs = Object.values(testplaneConfig.browsers).filter(browserConfig => {
        return Boolean(browserConfig.desiredCapabilities?.browserName);
    });
    if (format === BrowsersListOutputFormat.PLAIN) {
        const browsersArray = browserConfigs.map(browserConfig => {
            const { browserName, browserVersion } = browserConfig.desiredCapabilities || {};
            return browserVersion ? `${browserName}@${browserVersion}` : browserName;
        });
        return lodash_1.default.uniq(browsersArray).sort();
    }
    const browsersArray = browserConfigs.map(browserConfig => {
        const { browserName, browserVersion } = browserConfig.desiredCapabilities || {};
        return { browserName: browserName, browserVersion };
    });
    return (0, lodash_1.default)(browsersArray).uniq().sortBy(["browserName", "browserVersion"]).value();
};
const registerCmd = (cliTool, testplane) => {
    cliTool
        .command(commandName)
        .description("Lists all browsers from the config")
        .option("-c, --config <path>", "path to configuration file")
        .option("--type [type]", "return browsers in specified type ('tags': browserName and browserVersion, 'ids': browserId from config)", String, BrowsersListOutputType.TAGS)
        .option("--format [format]", "return browsers in specified format ('json' / 'plain')", String, BrowsersListOutputFormat.JSON)
        .action(async (options) => {
        const { type, format } = options;
        try {
            validateOption(BrowsersListOutputType, type, "type");
            validateOption(BrowsersListOutputFormat, format, "format");
            const browsersSorted = type === BrowsersListOutputType.IDS
                ? extractBrowserIds(testplane.config)
                : extractBrowserTags(testplane.config, format);
            const outputResult = format === BrowsersListOutputFormat.PLAIN
                ? browsersSorted.join(" ")
                : JSON.stringify(browsersSorted);
            console.info(outputResult);
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