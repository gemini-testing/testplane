import type { ExitOnErrorConfig } from "../config/types";
import type { Test } from "../types";

export type CheckTestError = (test: Test) => Error | undefined;

/** Shared by all browsers for a single run. */
export class ExitOnError {
    private stopped = false;
    private readonly rules;

    constructor(config: ExitOnErrorConfig) {
        this.rules = config.enabled
            ? config.filters.map(({ name, filter, limit }) => ({
                  name,
                  // Do not mutate the user's RegExp (including its lastIndex).
                  filter: typeof filter === "function" ? filter : new RegExp(filter.source, filter.flags),
                  limit,
                  count: 0,
              }))
            : [];
    }

    check(test: Test): Error | undefined {
        if (this.stopped || !test.err) {
            return undefined;
        }

        const errorText = test.err.message;

        for (const rule of this.rules) {
            let matches: boolean;
            try {
                if (typeof rule.filter === "function") {
                    matches = rule.filter(errorText);
                    if (typeof matches !== "boolean") {
                        // Also consume rejections from an accidentally async filter.
                        void Promise.resolve(matches).catch(() => {});
                        throw new TypeError("filter must synchronously return a boolean");
                    }
                } else {
                    rule.filter.lastIndex = 0;
                    matches = rule.filter.test(errorText);
                }
            } catch (cause) {
                this.stopped = true;
                return new Error(`exitOnError filter "${rule.name}" failed`, { cause });
            }

            if (matches) {
                rule.count++;
                if (rule.count >= rule.limit) {
                    this.stopped = true;
                    return new Error(
                        `exitOnError rule "${rule.name}" reached its limit of ${rule.limit} matching errors: ${errorText}`,
                        { cause: test.err },
                    );
                }
            }
        }

        return undefined;
    }
}
