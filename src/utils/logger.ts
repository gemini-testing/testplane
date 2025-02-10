import format from "strftime";

const withTimestampPrefix =
    (logFnName: "log" | "warn" | "error") =>
    (...args: unknown[]): void => {
        const timestamp = format("%H:%M:%S %z");
        console[logFnName](`[${timestamp}]`, ...args);
    };

export const log = withTimestampPrefix("log");
export const warn = withTimestampPrefix("warn");
export const error = withTimestampPrefix("error");
