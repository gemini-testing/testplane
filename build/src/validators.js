"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUnknownBrowsers = void 0;
const util_1 = require("util");
const chalk_1 = __importDefault(require("chalk"));
const lodash_1 = __importDefault(require("lodash"));
const logger_1 = __importDefault(require("./utils/logger"));
const validateUnknownBrowsers = (browsers, configBrowsers) => {
    const unknownBrowsers = getUnknownBrowsers(browsers, configBrowsers);
    if (lodash_1.default.isEmpty(unknownBrowsers)) {
        return;
    }
    logger_1.default.warn((0, util_1.format)("%s Unknown browser ids: %s. Use one of the browser ids specified in the config file: %s", chalk_1.default.yellow("WARNING:"), unknownBrowsers.join(", "), configBrowsers.join(", ")));
};
exports.validateUnknownBrowsers = validateUnknownBrowsers;
function getUnknownBrowsers(browsers, configBrowsers) {
    return (0, lodash_1.default)(browsers).compact().uniq().difference(configBrowsers).value();
}
//# sourceMappingURL=validators.js.map