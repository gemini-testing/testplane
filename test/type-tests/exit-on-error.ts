import type { ConfigInput, ErrorPattern, MaxFailuresConfig } from "../../src";

export const patterns: ErrorPattern[] = ["Too Many Requests", /Access denied/i];
export const maxFailures: MaxFailuresConfig = { limit: 5, patterns };
export const config = {
    system: { maxFailures, patternsOnReject: patterns },
    browsers: { chrome: { desiredCapabilities: { browserName: "chrome" } } },
} satisfies ConfigInput;

export const numericConfig = { ...config, system: { maxFailures: 20 } } satisfies ConfigInput;

// @ts-expect-error patterns must be strings or regular expressions
export const invalidPattern: ErrorPattern = () => true;

// @ts-expect-error object form requires patterns
export const missingPatterns: MaxFailuresConfig = { limit: 5 };

export const invalidTopLevelConfig = {
    browsers: config.browsers,
    // @ts-expect-error maxFailures belongs in system
    maxFailures: 20,
} satisfies ConfigInput;
