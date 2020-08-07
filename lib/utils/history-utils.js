'use strict';

const stringify = require('json-stringify-safe');
const {isObject, isString, truncate} = require('lodash');

const ARG_MAX_SIZE = 4 * 1024;
const TOO_BIG_OBJECT = '... <<<too big object>>>';
const TOO_LONG_STRING = '... <<<too long string>>>';

const normalizeArg = (arg) => {
    if (isObject(arg)) {
        return truncate(stringify(arg), {length: ARG_MAX_SIZE, omission: TOO_BIG_OBJECT});
    } else if (isString(arg)) {
        return truncate(arg, {length: ARG_MAX_SIZE, omission: TOO_LONG_STRING});
    }

    return arg;
};

module.exports = {
    ARG_MAX_SIZE,
    normalizeArg
};
