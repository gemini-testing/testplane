import type { ConfigInput, ExitOnErrorConfig, ExitOnErrorRule } from "../../src";

export const exitOnError: ExitOnErrorConfig = {
    enabled: true,
    filters: [
        { name: "quota", filter: /Too Many Requests/i, limit: 5 },
        { name: "access", filter: text => text.includes("Access denied"), limit: 1 },
    ],
};

export const config = {
    exitOnError,
    browsers: { chrome: { desiredCapabilities: { browserName: "chrome" } } },
} satisfies ConfigInput;

export const partialConfig = { ...config, exitOnError: { enabled: false } } satisfies ConfigInput;

export const invalidFilter: ExitOnErrorRule = {
    name: "quota",
    // @ts-expect-error filters must be synchronous
    filter: async () => true,
    limit: 1,
};

// @ts-expect-error each rule must have a name
export const missingName: ExitOnErrorRule = { filter: /429/, limit: 1 };

export const invalidPerBrowserConfig = {
    browsers: {
        chrome: {
            desiredCapabilities: { browserName: "chrome" },
            // @ts-expect-error exitOnError applies to the whole run
            exitOnError,
        },
    },
} satisfies ConfigInput;
