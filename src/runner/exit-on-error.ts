import type { MaxFailuresConfigParsed } from "../config/types";
import type { Test } from "../types";

export class ExitOnError {
    private stopped = false;
    private count = 0;

    constructor(private readonly config: MaxFailuresConfigParsed = { limit: Infinity, patterns: null }) {}

    check(test: Test): Error | undefined {
        const { limit, patterns } = this.config;
        if (this.stopped || limit === Infinity || !test.err) {
            return undefined;
        }
        const error = test.err;

        if (
            patterns &&
            !patterns.some(pattern => {
                pattern.lastIndex = 0;
                return pattern.test(error.message);
            })
        ) {
            return undefined;
        }

        if (++this.count >= limit) {
            this.stopped = true;
            const description = patterns ? "matching errors" : "errors";
            return new Error(`system.maxFailures reached its limit of ${limit} ${description}: ${error.message}`, {
                cause: error,
            });
        }

        return undefined;
    }
}
