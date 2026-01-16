import format from "strftime";

const LOG_OPTIONS = Symbol("logOptions");

export interface LogOptions {
    timestamp?: boolean;
    prefixEachLine?: string;
}

export function withLogOptions(opts: LogOptions): { [LOG_OPTIONS]: LogOptions } {
    return { [LOG_OPTIONS]: opts };
}

const withTimestampPrefix =
    (logFnName: "log" | "warn" | "error") =>
    (...args: unknown[]): void => {
        const lastArg = args[args.length - 1];
        const options =
            lastArg && typeof lastArg === "object" && LOG_OPTIONS in lastArg
                ? (args.pop() as { [LOG_OPTIONS]: LogOptions })[LOG_OPTIONS]
                : undefined;

        const shouldTimestamp = options?.timestamp !== false;

        let transformedArgs = args;
        if (options?.prefixEachLine) {
            transformedArgs = transformedArgs.map(arg => {
                return String(arg)
                    .split("\n")
                    .map(line => `${options.prefixEachLine}${line}`)
                    .join("\n");
            });
        }

        if (shouldTimestamp) {
            const timestamp = format("%H:%M:%S %z");
            console[logFnName](`[${timestamp}]`, ...transformedArgs);
        } else {
            console[logFnName](...transformedArgs);
        }
    };

export const log = withTimestampPrefix("log");
export const warn = withTimestampPrefix("warn");
export const error = withTimestampPrefix("error");
