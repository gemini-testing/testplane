"use strict";

const format = require("strftime");

const withTimestampPrefix =
    logFnName =>
    (...args) => {
        const timestamp = format("%H:%M:%S %z");
        console[logFnName](`[${timestamp}]`, ...args);
    };

module.exports = {
    log: withTimestampPrefix("log"),
    warn: withTimestampPrefix("warn"),
    error: withTimestampPrefix("error"),
};
