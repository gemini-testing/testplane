"use strict";

const { format } = require("date-fns");

const withTimestampPrefix =
    logFnName =>
    (...args) => {
        const timestamp = format(new Date(), "HH:mm:ss OO");
        console[logFnName](`[${timestamp}]`, ...args);
    };

const stringifyError = error => {
    try {
        return error.toString() === "[object Object]" ? JSON.stringify(error) : error;
    } catch {
        return error;
    }
};

module.exports = {
    log: withTimestampPrefix("log"),
    warn: withTimestampPrefix("warn"),
    error: withTimestampPrefix("error"),
    stringifyError,
};
