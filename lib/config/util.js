'use strict';

const path = require('path');
const configparser = require('gemini-configparser');

const option = configparser.option;
const map = configparser.map;

const is = exports.is = (type) => {
    return (value) => {
        if (typeof value !== type) {
            throw new Error(`a value must be ${type}`);
        }
    };
};

exports.resolveWithProjectDir = (value, config) => {
    return value ? path.resolve(process.cwd(), value) : value;
};

const parseBoolean = exports.parseBoolean = (value) => {
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

exports.booleanOption = (defaultValue) => {
    return option({
        parseCli: parseBoolean,
        parseEnv: parseBoolean,
        validate: is('boolean'),
        defaultValue: defaultValue
    });
};

exports.positiveIntegerOption = (defaultValue) => {
    return option({
        parseEnv: Number,
        parseCli: Number,
        defaultValue: defaultValue,
        validate: (value) => {
            if (typeof value !== 'number' || Math.floor(value) !== value) {
                throw new Error('Field must be an integer number');
            } else if (value <= 0) {
                throw new Error('Field must be positive');
            }
        }
    });
};

exports.anyObject = () => map(option({}));
