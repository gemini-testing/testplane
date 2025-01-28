"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addUserAgentToArgs = exports.parsePrimitive = exports.parseBoolean = exports.assertPositiveIntegerOrInfinity = exports.assertPositiveInteger = exports.assertEnum = exports.assertNonNegativeInteger = exports.assertOptionalArray = exports.assertOptionalObject = exports.assertNonNegativeNumber = exports.is = void 0;
const lodash_1 = __importDefault(require("lodash"));
const is = (type, name) => {
    return (value) => {
        if (typeof value !== type) {
            throw new Error(`"${name}" must be a ${type}`);
        }
    };
};
exports.is = is;
const assertNonNegativeNumber = (value, name) => {
    (0, exports.is)("number", name)(value);
    if (value < 0) {
        throw new Error(`"${name}" must be non-negative`);
    }
};
exports.assertNonNegativeNumber = assertNonNegativeNumber;
const assertOptionalObject = (value, name) => {
    if (!lodash_1.default.isNull(value) && !lodash_1.default.isPlainObject(value)) {
        throw new Error(`"${name}" must be an object`);
    }
};
exports.assertOptionalObject = assertOptionalObject;
const assertOptionalArray = (value, name) => {
    if (!lodash_1.default.isArray(value)) {
        throw new Error(`"${name}" must be an array`);
    }
};
exports.assertOptionalArray = assertOptionalArray;
const assertNonNegativeInteger = (value, name) => {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`"${name}" must be a non-negative integer`);
    }
};
exports.assertNonNegativeInteger = assertNonNegativeInteger;
const assertEnum = (enumValues, value, name) => {
    (0, exports.is)("string", name)(value);
    if (!lodash_1.default.includes(enumValues, value)) {
        throw new Error(`"${name}" must be one of: ${enumValues.join(", ")}`);
    }
};
exports.assertEnum = assertEnum;
const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;
const assertPositiveInteger = (value, name) => {
    if (!isPositiveInteger(value)) {
        throw new Error(`"${name}" must be a positive integer`);
    }
};
exports.assertPositiveInteger = assertPositiveInteger;
const assertPositiveIntegerOrInfinity = (value, name) => {
    if (!isPositiveInteger(value) && value !== Infinity) {
        throw new Error(`"${name}" must be a positive integer or Infinity`);
    }
};
exports.assertPositiveIntegerOrInfinity = assertPositiveIntegerOrInfinity;
const parseBoolean = (value, name) => {
    switch (value.toLowerCase()) {
        case "1":
        case "yes":
        case "true":
            return true;
        case "0":
        case "no":
        case "false":
            return false;
        default:
            throw new Error(`Unexpected value for boolean option "${name}"`);
    }
};
exports.parseBoolean = parseBoolean;
const parsePrimitive = (str) => {
    try {
        return JSON.parse(str);
    }
    catch (error) {
        throw new Error("a value must be a primitive type");
    }
};
exports.parsePrimitive = parsePrimitive;
const addUserAgentToArgs = (config) => {
    for (const browserKey in config.browsers) {
        const browserConfig = config.browsers[browserKey];
        const chromeOptions = browserConfig.desiredCapabilities?.["goog:chromeOptions"];
        if (chromeOptions?.mobileEmulation?.userAgent) {
            const userAgent = chromeOptions.mobileEmulation.userAgent;
            chromeOptions.args = chromeOptions.args || [];
            const userAgentArg = `user-agent=${userAgent}`;
            if (!chromeOptions.args.find(arg => arg.startsWith("user-agent="))) {
                chromeOptions.args.push(userAgentArg);
            }
        }
    }
    return config;
};
exports.addUserAgentToArgs = addUserAgentToArgs;
//# sourceMappingURL=utils.js.map