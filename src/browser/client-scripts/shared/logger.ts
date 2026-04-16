interface DebugOpts {
    debug?: string[];
}

interface DebugLogger {
    (...args: unknown[]): string;
    log: string;
    enabled: boolean;
}

interface CreateDebugLoggerFn {
    (opts: DebugOpts, debugTopic: string): DebugLogger;
}

function makeCreateDebugLogger(): CreateDebugLoggerFn {
    const fn = function (opts: DebugOpts, debugTopic: string): DebugLogger {
        // fn.log = "";

        if (opts.debug && opts.debug.indexOf(debugTopic) !== -1) {
            const enabledLogger = function (...args: unknown[]): string {
                for (const arg of args) {
                    if (typeof arg === "object" && arg !== null) {
                        try {
                            enabledLogger.log += JSON.stringify(arg, null, 2) + "\n";
                        } catch (e) {
                            enabledLogger.log += "failed to log message due to an error: " + e;
                        }
                    } else {
                        enabledLogger.log += String(arg) + "\n";
                    }
                }
                return enabledLogger.log;
            } as DebugLogger;
            enabledLogger.enabled = true;
            enabledLogger.log = "";
            return enabledLogger;
        }

        const disabledLogger = function (): string {
            return "";
        } as DebugLogger;
        disabledLogger.enabled = false;
        return disabledLogger;
    } as CreateDebugLoggerFn;
    // fn.log = "";
    return fn;
}

export const createDebugLogger: CreateDebugLoggerFn = makeCreateDebugLogger();
