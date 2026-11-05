import type { ConfigInput, ErrorPattern, ErrorPatterns, MaxFailuresConfig } from "../../src";

export const patterns: ErrorPatterns = [
    { name: "quota", pattern: /Too Many Requests/i },
    { name: "access", pattern: text => text.includes("Access denied") },
];

export const maxFailures: MaxFailuresConfig = { limit: 5, patterns };
export const config = {
    system: { maxFailures, patternsOnReject: patterns },
    browsers: { chrome: { desiredCapabilities: { browserName: "chrome" } } },
} satisfies ConfigInput;

export const numericConfig = { ...config, system: { maxFailures: 20 } } satisfies ConfigInput;
export const immediateConfig = { ...config, system: { patternsOnReject: patterns } } satisfies ConfigInput;
export const legacyConfig = {
    ...config,
    system: { maxFailures: { limit: 20, patterns: ["429", /403/] } },
} satisfies ConfigInput;

export const invalidPattern: ErrorPattern = {
    name: "quota",
    // @ts-expect-error patterns must be synchronous
    pattern: async () => true,
};

// @ts-expect-error each named pattern must have a name
export const missingName: ErrorPattern = { pattern: /429/ };

// @ts-expect-error object form requires patterns
export const missingPatterns: MaxFailuresConfig = { limit: 5 };

export const invalidPatternLimit: ErrorPattern = {
    name: "quota",
    pattern: /429/,
    // @ts-expect-error the limit is shared, not per pattern
    limit: 5,
};

export const invalidEnabled: MaxFailuresConfig = {
    limit: 5,
    patterns,
    // @ts-expect-error there is no enabled option
    enabled: true,
};

export const invalidTopLevelConfig = {
    browsers: config.browsers,
    // @ts-expect-error maxFailures belongs in system
    maxFailures: 20,
} satisfies ConfigInput;
