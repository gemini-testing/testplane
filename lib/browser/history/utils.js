'use strict';

const _ = require('lodash');
const P = require('bluebird');

const MAX_STRING_LENGTH = 50;

exports.normalizeCommandArgs = (name, args) => {
    if (name === 'execute') {
        return 'code';
    }

    return args.map((arg) => {
        if (_.isString(arg)) {
            return _.truncate(arg, {length: MAX_STRING_LENGTH});
        }

        if (_.isPlainObject(arg)) {
            return 'obj';
        }

        return arg;
    });
};

exports.historyDataMap = {
    NAME: 'n',
    ARGS: 'a',
    SCOPE: 's',
    DURATION: 'd',
    TIME_START: 'ts',
    TIME_END: 'te',
    IS_OVERWRITTEN: 'o',
    CHILDREN: 'c'
};

exports.runWithHooks = ({fn, before, after}) => P
    .resolve()
    .then(before)
    .then(fn)
    .finally(after);
