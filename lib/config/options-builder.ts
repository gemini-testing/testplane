import _ from 'lodash';
import { option, map } from 'gemini-configparser';
import * as utils from './utils';

const assertNonNegativeInteger = utils.assertNonNegativeInteger;
const assertPositiveInteger = utils.assertPositiveInteger;
const assertPositiveIntegerOrInfinity = utils.assertPositiveIntegerOrInfinity;
const assertOptionalObject = utils.assertOptionalObject;
const assertOptionalArray = utils.assertOptionalArray;
const parseBoolean = utils.parseBoolean;
const parsePrimitive = utils.parsePrimitive;
const is = utils.is;

export default (defaultFactory) => {
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
        hexString
    };

    function boolean(name: string) {
        return option({
            parseCli: (value) => parseBoolean(value, name),
            parseEnv: (value) => parseBoolean(value, name),
            defaultValue: defaultFactory(name),
            validate: is('boolean', name)
        });
    }

    function optionalBoolean(name: string) {
        return option({
            parseCli: (value) => parseBoolean(value, name),
            parseEnv: (value) => parseBoolean(value, name),
            defaultValue: defaultFactory(name),
            validate: (value) => _.isNull(value) || is('boolean', name)(value)
        });
    }

    function optionalArray(name: string) {
        return option({
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            defaultValue: defaultFactory(name),
            validate: (value) => assertOptionalArray(value, name)
        });
    }

    function optionalObject(name: string) {
        return option({
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            defaultValue: defaultFactory(name),
            validate: (value) => assertOptionalObject(value, name)
        });
    }

    function optionalFunction(name: string) {
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

    function nonNegativeInteger(name: string) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: (value) => assertNonNegativeInteger(value, name)
        });
    }

    function optionalNonNegativeInteger(name: string) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: (value) => _.isNull(value) || assertNonNegativeInteger(value, name)
        });
    }

    function string(name: string) {
        return option({
            defaultValue: defaultFactory(name),
            validate: is('string', name)
        });
    }

    function optionalString(name: string) {
        return option({
            defaultValue: defaultFactory(name),
            validate: (value) => _.isNull(value) || is('string', name)(value)
        });
    }

    function positiveInteger(name: string) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: (value) => assertPositiveInteger(value, name)
        });
    }

    function positiveIntegerOrInfinity(name: string) {
        return option({
            parseEnv: Number,
            parseCli: Number,
            defaultValue: defaultFactory(name),
            validate: (value) => assertPositiveIntegerOrInfinity(value, name)
        });
    }

    function stringOrFunction(name: string) {
        return option({
            defaultValue: defaultFactory(name),
            validate: (value) => {
                if (!_.isString(value) && !_.isFunction(value)) {
                    throw new Error(`"${name}" must be a string or function`);
                }
            }
        });
    }

    function hexString(name: string) {
        return option({
            defaultValue: defaultFactory(name),
            validate: (value) => {
                is('string', name)(value);

                if (!/^#[\da-f]{6}$/i.test(value)) {
                    throw new Error(`"${name}" must be a hexadecimal color string (i.e. #ff0000)`);
                }
            }
        });
    }
};
