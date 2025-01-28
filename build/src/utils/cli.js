"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCommonCliOptions = exports.handleRequires = exports.compileGrep = exports.collectCliValues = void 0;
const lodash_1 = __importDefault(require("lodash"));
const logger_1 = __importDefault(require("./logger"));
const module_1 = require("./module");
const collectCliValues = (newValue, array = []) => {
    return array.concat(newValue);
};
exports.collectCliValues = collectCliValues;
const compileGrep = (grep) => {
    try {
        return new RegExp(`(${grep})|(${lodash_1.default.escapeRegExp(grep)})`);
    }
    catch (error) {
        logger_1.default.warn(`Invalid regexp provided to grep, searching by its string representation. ${error}`);
        return new RegExp(lodash_1.default.escapeRegExp(grep));
    }
};
exports.compileGrep = compileGrep;
const handleRequires = async (requires = []) => {
    for (const modulePath of requires) {
        await (0, module_1.requireModule)(modulePath);
    }
};
exports.handleRequires = handleRequires;
const withCommonCliOptions = ({ cmd, actionName = "run" }) => {
    const isMainCmd = ["testplane", "hermione"].includes(cmd.name());
    if (!isMainCmd) {
        cmd.option("-c, --config <path>", "path to configuration file");
    }
    return cmd
        .option("-b, --browser <browser>", `${actionName} tests only in specified browser`, exports.collectCliValues)
        .option("-s, --set <set>", `${actionName} tests only in the specified set`, exports.collectCliValues)
        .option("-r, --require <module>", "require module", exports.collectCliValues)
        .option("--grep <grep>", `${actionName} only tests matching the pattern`, exports.compileGrep);
};
exports.withCommonCliOptions = withCommonCliOptions;
//# sourceMappingURL=cli.js.map