import type { SystemConfig } from "../config/types";
import type { Test } from "../types";
import { createErrorMatchers, type ErrorMatcher } from "../utils/error-patterns";

export type CheckTestError = (test: Test) => Error | undefined;

/** Shared by all browsers for a single run. */
export class ExitOnError {
    private stopped = false;
    private count = 0;
    private readonly limit: number;
    private readonly patterns: ErrorMatcher[] | undefined;
    private readonly patternsOnReject: ErrorMatcher[];

    constructor({
        maxFailures = Infinity,
        patternsOnReject = [],
    }: Pick<SystemConfig, "maxFailures" | "patternsOnReject">) {
        this.patternsOnReject = createErrorMatchers(patternsOnReject, "system.patternsOnReject");
        this.limit = typeof maxFailures === "number" ? maxFailures : maxFailures.limit;
        this.patterns =
            typeof maxFailures === "number"
                ? undefined
                : createErrorMatchers(maxFailures.patterns, "system.maxFailures");
    }

    check(test: Test): Error | undefined {
        if (this.stopped || !test.err) {
            return undefined;
        }

        const errorText = test.err.message;
        try {
            const rejected = this.patternsOnReject.find(pattern => pattern.matches(errorText));
            if (rejected) {
                this.stopped = true;
                return new Error(`system.patternsOnReject matched pattern "${rejected.name}": ${errorText}`, {
                    cause: test.err,
                });
            }

            if (this.limit === Infinity) {
                return undefined;
            }
            const matched = this.patterns?.find(pattern => pattern.matches(errorText));
            if (this.patterns && !matched) {
                return undefined;
            }

            // Count each failed attempt once, even when several patterns match.
            if (++this.count >= this.limit) {
                this.stopped = true;
                const description = matched ? `matching errors (pattern "${matched.name}")` : "errors";
                return new Error(`system.maxFailures reached its limit of ${this.limit} ${description}: ${errorText}`, {
                    cause: test.err,
                });
            }
        } catch (error) {
            this.stopped = true;
            return error as Error;
        }

        return undefined;
    }
}
