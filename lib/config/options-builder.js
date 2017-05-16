'use strict';

const _ = require('lodash');
const configparser = require('gemini-configparser');
const utils = require('./utils');

const option = configparser.option;
const map = configparser.map;

const assertNonNegativeInteger = utils.assertNonNegativeInteger;
const assertPositiveInteger = utils.assertPositiveInteger;
const assertOptionalObject = utils.assertOptionalObject;
const parseBoolean = utils.parseBoolean;
const parsePrimitive = utils.parsePrimitive;
const is = utils.is;

module.exports = (defaultFactory) => {
    return {
        boolean,
        optionalObject,
        optionalFunction,
        anyObject,
        nonNegativeInteger,
        optionalNonNegativeInteger,
        string,
        optionalString,
        positiveInteger
    };

    function boolean(name) {
        return option({
            parseCli: (value) => parseBoolean(value, name),
            parseEnv: (value) => parseBoolean(value, name),
            defaultValue: defaultFactory(name),
            validate: is('boolean', name)
        });
    }

    function optionalObject(name) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: (value) => assertOptionalObject(value, name)
        });
    }

    function optionalFunction(name) {
        return option({
            defaultValue: defaultFactory(name),
            validate: (value) => _.isNull(value) || is('function', name)(value)
        });
    }

    function anyObject() {
        return map(option({
            parseEnv: parsePrimitive,
            parseCli: parsePrimitive
        }));
    }

    function nonNegativeInteger(name) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: (value) => assertNonNegativeInteger(value, name)
        });
    }

    function optionalNonNegativeInteger(name) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: (value) => _.isNull(value) || assertNonNegativeInteger(value, name)
        });
    }

    function string(name) {
        return option({
            defaultValue: defaultFactory(name),
            validate: is('string', name)
        });
    }

    function optionalString(name) {
        return option({
            defaultValue: defaultFactory(name),
            validate: (value) => _.isNull(value) || is('string', name)(value)
        });
    }

    function positiveInteger(name) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: (value) => assertPositiveInteger(value, name)
        });
    }
};
