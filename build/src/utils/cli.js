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
exports.withCommonCliOptions = exports.handleRequires = exports.compileGrep = exports.collectCliValues = void 0;
const lodash_1 = __importDefault(require("lodash"));
const logger = __importStar(require("./logger"));
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
        logger.warn(`Invalid regexp provided to grep, searching by its string representation. ${error}`);
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