'use strict';

const path = require('path');

const configparser = require('gemini-configparser');
const option = configparser.option;
const map = configparser.map;

const is = (type) => {
    return (value) => {
        if (typeof value !== type) {
            throw new Error(`a value must be ${type}`);
        }
    };
};

const resolveWithProjectRoot = (value, config) => {
    return value ? path.resolve(config.projectRoot, value) : value;
};

const parseBoolean = (value) => {
    switch (value.toLowerCase()) {
        case '1':
        case 'yes':
        case 'true':
            return true;
        case '0':
        case 'no':
        case 'false':
            return false;
        default:
            throw new Error(`Unexpected value for boolean option ${value}`);
    }
};

const booleanOption = (defaultValue) => {
    return option({
        parseCli: parseBoolean,
        parseEnv: parseBoolean,
        validate: is('boolean'),
        defaultValue: defaultValue
    });
};

const positiveIntegerOption = (defaultValue) => {
    return option({
        parseEnv: Number,
        parseCli: Number,
        defaultValue: defaultValue,
        validate: (value) => {
            if (typeof value !== 'number') {
                throw new Error('Field must be an integer number');
            }

            if (value <= 0) {
                throw new Error('Field  must be positive');
            }

            if (Math.floor(value) !== value) {
                throw new Error('Field must be an integer number');
            }
        }
    });
};

const anyObject = () => map(option({}));

exports.is = is;
exports.resolveWithProjectRoot = resolveWithProjectRoot;
exports.booleanOption = booleanOption;
exports.positiveIntegerOption = positiveIntegerOption;
exports.anyObject = anyObject;
