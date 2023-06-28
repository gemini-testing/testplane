"use strict";
const path = require("path");
const _ = require("lodash");
const is = (type, name) => {
    return value => {
        if (typeof value !== type) {
            throw new Error(`"${name}" must be a ${type}`);
        }
    };
};
exports.is = is;
exports.assertNonNegativeNumber = (value, name) => {
    is("number", name)(value);
    if (value < 0) {
        throw new Error(`"${name}" must be non-negative`);
    }
};
exports.assertOptionalObject = (value, name) => {
    if (!_.isNull(value) && !_.isPlainObject(value)) {
        throw new Error(`"${name}" must be an object`);
    }
};
exports.assertOptionalArray = (value, name) => {
    if (!_.isArray(value)) {
        throw new Error(`"${name}" must be an array`);
    }
};
exports.assertNonNegativeInteger = (value, name) => {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`"${name}" must be a non-negative integer`);
    }
};
exports.assertEnum = (enumValues, value, name) => {
    is("string", name)(value);
    if (!_.includes(enumValues, value)) {
        throw new Error(`"${name}" must be one of: ${enumValues.join(", ")}`);
    }
};
const isPositiveInteger = value => Number.isInteger(value) && value > 0;
exports.assertPositiveInteger = (value, name) => {
    if (!isPositiveInteger(value)) {
        throw new Error(`"${name}" must be a positive integer`);
    }
};
exports.assertPositiveIntegerOrInfinity = (value, name) => {
    if (!isPositiveInteger(value) && value !== Infinity) {
        throw new Error(`"${name}" must be a positive integer or Infinity`);
    }
};
exports.parseBoolean = exports.parseBoolean = (value, name) => {
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
exports.parsePrimitive = exports.parsePrimitive = str => {
    try {
        return JSON.parse(str);
    }
    catch (error) {
        throw new Error("a value must be a primitive type");
    }
};
exports.resolveWithProjectDir = value => (value ? path.resolve(process.cwd(), value) : value);
//# sourceMappingURL=utils.js.map