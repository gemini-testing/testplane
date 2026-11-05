import type { ErrorPatterns } from "../config/types";

export interface ErrorMatcher {
    name: string;
    matches: (errorText: string) => boolean;
}

export function createErrorMatchers(patterns: ErrorPatterns, option: string): ErrorMatcher[] {
    return patterns.map(rule => {
        const named = typeof rule === "object" && !(rule instanceof RegExp);
        const name = named ? rule.name : String(rule);
        const pattern = named ? rule.pattern : rule;
        // Clone regular expressions so repeated checks do not mutate user state.
        const matcher = typeof pattern === "function" ? pattern : new RegExp(pattern);

        return {
            name,
            matches(errorText): boolean {
                try {
                    if (typeof matcher === "function") {
                        const result = matcher(errorText);
                        if (typeof result !== "boolean") {
                            void Promise.resolve(result).catch(() => {});
                            throw new TypeError("pattern must synchronously return a boolean");
                        }
                        return result;
                    }
                    matcher.lastIndex = 0;
                    return matcher.test(errorText);
                } catch (cause) {
                    throw new Error(`${option} pattern "${name}" failed`, { cause });
                }
            },
        };
    });
}
