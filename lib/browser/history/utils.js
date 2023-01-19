'use strict';

const _ = require('lodash');

const MAX_STRING_LENGTH = 50;

exports.normalizeCommandArgs = (name, args) => {
    if (name === 'execute') {
        return ['code'];
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
    CHILDREN: 'c',
    KEY: 'k'
};

const isPromise = (val) => typeof _.get(val, 'then') === 'function';

exports.runWithHooks = ({fn, before, after}) => {
    let isReturnedValuePromise = false;

    before();

    try {
        const value = fn();

        if (isPromise(value)) {
            isReturnedValuePromise = true;

            return value.finally(after);
        }

        return value;
    } finally {
        if (!isReturnedValuePromise) {
            after();
        }
    }
};
