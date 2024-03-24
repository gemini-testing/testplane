import format from "strftime";

const withTimestampPrefix =
    logFnName =>
    (...args) => {
        const timestamp = format("%H:%M:%S %z");
        console[logFnName](`[${timestamp}]`, ...args);
    };

export default {
    log: withTimestampPrefix("log"),
    warn: withTimestampPrefix("warn"),
    error: withTimestampPrefix("error"),
};
