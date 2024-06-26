"use strict";

const _ = require("lodash");

const MAX_STRING_LENGTH = 50;

exports.normalizeCommandArgs = (name, args = []) => {
    if (name === "execute") {
        return ["code"];
    }

    return args.map(arg => {
        if (_.isString(arg)) {
            return _.truncate(arg, { length: MAX_STRING_LENGTH });
        }

        if (_.isPlainObject(arg)) {
            return "obj";
        }

        return arg;
    });
};

exports.historyDataMap = {
    NAME: "n",
    ARGS: "a",
    SCOPE: "s",
    DURATION: "d",
    TIME_START: "ts",
    TIME_END: "te",
    IS_OVERWRITTEN: "o",
    IS_GROUP: "g",
    IS_FAILED: "f",
    CHILDREN: "c",
    KEY: "k",
};

const isPromise = val => typeof _.get(val, "then") === "function";

exports.isGroup = node => Boolean(node && node[exports.historyDataMap.IS_GROUP]);

exports.runWithHooks = ({ fn, before, after, error }) => {
    let isReturnedValuePromise = false;

    before();

    try {
        const value = fn();

        if (isPromise(value)) {
            isReturnedValuePromise = true;

            return value
                .catch(err => {
                    error(err);

                    throw err;
                })
                .finally(after);
        }

        return value;
    } catch (err) {
        if (!isReturnedValuePromise) {
            error(err);

            throw err;
        }
    } finally {
        if (!isReturnedValuePromise) {
            after();
        }
    }
};
