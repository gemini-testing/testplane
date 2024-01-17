"use strict";
const _ = require("lodash");
const configparser = require("gemini-configparser");
const utils = require("./utils");
const option = configparser.option;
const map = configparser.map;
const assertNonNegativeInteger = utils.assertNonNegativeInteger;
const assertPositiveInteger = utils.assertPositiveInteger;
const assertPositiveIntegerOrInfinity = utils.assertPositiveIntegerOrInfinity;
const assertOptionalObject = utils.assertOptionalObject;
const assertOptionalArray = utils.assertOptionalArray;
const assertEnum = utils.assertEnum;
const parseBoolean = utils.parseBoolean;
const parsePrimitive = utils.parsePrimitive;
const is = utils.is;
module.exports = defaultFactory => {
    return {
        boolean,
        optionalBoolean,
        optionalArray,
        optionalObject,
        optionalFunction,
        anyObject,
        nonNegativeInteger,
        optionalNonNegativeInteger,
        string,
        optionalString,
        positiveInteger,
        positiveIntegerOrInfinity,
        stringOrFunction,
        hexString,
        enumeration,
    };
    function boolean(name, opts = { isDeprecated: false }) {
        return option({
            defaultValue: defaultFactory(name),
            parseCli: value => parseBoolean(value, name),
            parseEnv: value => parseBoolean(value, name),
            validate: is("boolean", name),
            isDeprecated: opts.isDeprecated,
        });
    }
    function optionalBoolean(name) {
        return option({
            parseCli: value => parseBoolean(value, name),
            parseEnv: value => parseBoolean(value, name),
            defaultValue: defaultFactory(name),
            validate: value => _.isNull(value) || is("boolean", name)(value),
        });
    }
    function optionalArray(name) {
        return option({
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            defaultValue: defaultFactory(name),
            validate: value => assertOptionalArray(value, name),
        });
    }
    function optionalObject(name) {
        return option({
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            defaultValue: defaultFactory(name),
            validate: value => assertOptionalObject(value, name),
        });
    }
    function optionalFunction(name) {
        return option({
            defaultValue: defaultFactory(name),
            validate: value => _.isNull(value) || is("function", name)(value),
        });
    }
    function anyObject() {
        return map(option({
            parseEnv: parsePrimitive,
            parseCli: parsePrimitive,
        }));
    }
    function nonNegativeInteger(name) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: value => assertNonNegativeInteger(value, name),
        });
    }
    function optionalNonNegativeInteger(name, opts = { isDeprecated: false }) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: value => _.isNull(value) || assertNonNegativeInteger(value, name),
            isDeprecated: opts.isDeprecated,
        });
    }
    function string(name) {
        return option({
            defaultValue: defaultFactory(name),
            validate: is("string", name),
        });
    }
    function optionalString(name) {
        return option({
            defaultValue: defaultFactory(name),
            validate: value => _.isNull(value) || is("string", name)(value),
        });
    }
    function positiveInteger(name) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: value => assertPositiveInteger(value, name),
        });
    }
    function positiveIntegerOrInfinity(name) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: value => assertPositiveIntegerOrInfinity(value, name),
        });
    }
    function stringOrFunction(name) {
        return option({
            defaultValue: defaultFactory(name),
            validate: value => {
                if (!_.isString(value) && !_.isFunction(value)) {
                    throw new Error(`"${name}" must be a string or function`);
                }
            },
        });
    }
    function hexString(name) {
        return option({
            defaultValue: defaultFactory(name),
            validate: value => {
                is("string", name)(value);
                if (!/^#[\da-f]{6}$/i.test(value)) {
                    throw new Error(`"${name}" must be a hexadecimal color string (i.e. #ff0000)`);
                }
            },
        });
    }
    function enumeration(name, enumValues, customOptionConfig) {
        return option({
            defaultValue: defaultFactory(name),
            validate: value => assertEnum(enumValues, value, name),
            ...customOptionConfig,
        });
    }
};
//# sourceMappingURL=options-builder.js.map