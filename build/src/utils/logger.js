"use strict";
const { format } = require("date-fns");
const withTimestampPrefix = logFnName => (...args) => {
    const timestamp = format(new Date(), "HH:mm:ss OO");
    console[logFnName](`[${timestamp}]`, ...args);
};
module.exports = {
    log: withTimestampPrefix("log"),
    warn: withTimestampPrefix("warn"),
    error: withTimestampPrefix("error"),
};
//# sourceMappingURL=logger.js.map