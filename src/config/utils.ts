import _ from "lodash";
import { ConfigParsed, SelectivityMode, SelectivityModeValue } from "./types";

type ValueType = "string" | "number" | "boolean" | "object" | "undefined" | "function";

export const is = (type: ValueType, name: string) => {
    return (value: unknown): void => {
        if (typeof value !== type) {
            const lines: string[] = [];
            lines.push(
                `What happened: Config option "${name}" has an invalid type. Expected ${type}, but got ${typeof value}.`,
            );
            lines.push("\nPossible reasons:");
            lines.push(`  - The value was set to a wrong type (e.g. a string where a ${type} is expected)`);
            lines.push("  - An environment variable or CLI argument was parsed incorrectly");
            lines.push("\nWhat you can do:");
            lines.push(`  - Set "${name}" to a value of type ${type} in your testplane.config.js`);
            lines.push("  - Check environment variable overrides for this option");
            throw new Error(lines.join("\n"));
        }
    };
};

export const assertNonNegativeNumber = (value: number, name: string): void => {
    is("number", name)(value);
    if (value < 0) {
        const lines: string[] = [];
        lines.push(`What happened: Config option "${name}" must be a non-negative number, but got ${value}.`);
        lines.push("\nPossible reasons:");
        lines.push("  - A negative value was accidentally set");
        lines.push("  - An environment variable was set to a negative number");
        lines.push("\nWhat you can do:");
        lines.push(`  - Set "${name}" to 0 or a positive number in your testplane.config.js`);
        throw new Error(lines.join("\n"));
    }
};

export const assertOptionalObject = (value: unknown, name: string): void => {
    if (!_.isNull(value) && !_.isPlainObject(value)) {
        const lines: string[] = [];
        lines.push(`What happened: Config option "${name}" must be a plain object or null, but got ${typeof value}.`);
        lines.push("\nPossible reasons:");
        lines.push("  - The option was set to an array or a class instance instead of a plain object");
        lines.push("  - The option was set to a primitive value");
        lines.push("\nWhat you can do:");
        lines.push(`  - Set "${name}" to a plain object (e.g. { key: value }) or null in your testplane.config.js`);
        throw new Error(lines.join("\n"));
    }
};

export const assertOptionalArray = (value: unknown, name: string): void => {
    if (!_.isArray(value)) {
        const lines: string[] = [];
        lines.push(`What happened: Config option "${name}" must be an array, but got ${typeof value}.`);
        lines.push("\nPossible reasons:");
        lines.push("  - The option was set to a single value instead of an array");
        lines.push("  - The option was not initialized as an array");
        lines.push("\nWhat you can do:");
        lines.push(`  - Wrap the value in an array: "${name}": [value]`);
        throw new Error(lines.join("\n"));
    }
};

export const assertNonNegativeInteger = (value: number, name: string): void => {
    if (!Number.isInteger(value) || value < 0) {
        const lines: string[] = [];
        lines.push(`What happened: Config option "${name}" must be a non-negative integer, but got ${value}.`);
        lines.push("\nPossible reasons:");
        lines.push("  - A floating-point number was used instead of an integer");
        lines.push("  - A negative integer was set");
        lines.push("\nWhat you can do:");
        lines.push(`  - Set "${name}" to a whole number >= 0 in your testplane.config.js`);
        throw new Error(lines.join("\n"));
    }
};

export const assertEnum = (enumValues: string[], value: string, name: string): void => {
    is("string", name)(value);

    if (!_.includes(enumValues, value)) {
        const lines: string[] = [];
        lines.push(`What happened: Config option "${name}" has an invalid value "${value}".`);
        lines.push("\nPossible reasons:");
        lines.push("  - The value is misspelled");
        lines.push("  - The value is not in the list of allowed options");
        lines.push("\nWhat you can do:");
        lines.push(`  - Set "${name}" to one of the allowed values: ${enumValues.join(", ")}`);
        throw new Error(lines.join("\n"));
    }
};

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

export const assertPositiveInteger = (value: number, name: string): void => {
    if (!isPositiveInteger(value)) {
        const lines: string[] = [];
        lines.push(`What happened: Config option "${name}" must be a positive integer, but got ${value}.`);
        lines.push("\nPossible reasons:");
        lines.push("  - The value is 0, negative, or a non-integer");
        lines.push("\nWhat you can do:");
        lines.push(`  - Set "${name}" to a whole number > 0 in your testplane.config.js`);
        throw new Error(lines.join("\n"));
    }
};

export const assertPositiveIntegerOrInfinity = (value: number, name: string): void => {
    if (!isPositiveInteger(value) && value !== Infinity) {
        const lines: string[] = [];
        lines.push(`What happened: Config option "${name}" must be a positive integer or Infinity, but got ${value}.`);
        lines.push("\nPossible reasons:");
        lines.push("  - The value is 0, negative, a non-integer, or NaN");
        lines.push("\nWhat you can do:");
        lines.push(`  - Set "${name}" to a whole number > 0 or Infinity in your testplane.config.js`);
        throw new Error(lines.join("\n"));
    }
};

export const parseBoolean = (value: string, name: string): boolean => {
    switch (value.toLowerCase()) {
        case "1":
        case "yes":
        case "true":
            return true;
        case "0":
        case "no":
        case "false":
            return false;
        default: {
            const lines: string[] = [];
            lines.push(`What happened: Could not parse boolean value for config option "${name}". Got: "${value}".`);
            lines.push("\nPossible reasons:");
            lines.push("  - An environment variable was set to an unrecognized boolean string");
            lines.push("\nWhat you can do:");
            lines.push(
                `  - Set the environment variable for "${name}" to one of: "true", "false", "1", "0", "yes", "no"`,
            );
            throw new Error(lines.join("\n"));
        }
    }
};

export const parsePrimitive = <T = unknown>(str: string): T => {
    try {
        return JSON.parse(str);
    } catch (error) {
        const lines: string[] = [];
        lines.push(`What happened: Could not parse the value "${str}" as a JSON primitive.`);
        lines.push("\nPossible reasons:");
        lines.push("  - The value is not valid JSON (e.g. a bare string without quotes)");
        lines.push("  - An environment variable override contains a malformed value");
        lines.push("\nWhat you can do:");
        lines.push('  - Wrap string values in quotes: "myValue" -> \'"myValue"\'');
        lines.push('  - Use a valid JSON literal: true, false, null, 42, 3.14, or "string"');
        throw new Error(lines.join("\n"));
    }
};

export const addUserAgentToArgs = (config: ConfigParsed): ConfigParsed => {
    for (const browserKey in config.browsers) {
        const browserConfig = config.browsers[browserKey];
        const chromeOptions = browserConfig.desiredCapabilities?.["goog:chromeOptions"];

        if (chromeOptions?.mobileEmulation?.userAgent) {
            const userAgent = chromeOptions.mobileEmulation.userAgent;
            chromeOptions.args = chromeOptions.args || [];

            const userAgentArg = `user-agent=${userAgent}`;
            if (!chromeOptions.args.find(arg => arg.startsWith("user-agent="))) {
                chromeOptions.args.push(userAgentArg);
            }
        }
    }

    return config;
};

export const extractSelectivityEnabledEnvVariable = (
    envPrefixes: string[] = [],
): { enabled?: SelectivityModeValue } => {
    for (const envPrefix of envPrefixes) {
        const envName = envPrefix + "selectivity_enabled";

        switch (process.env[envName]) {
            case String(SelectivityMode.Enabled):
                return { enabled: SelectivityMode.Enabled };
            case String(SelectivityMode.Disabled):
                return { enabled: SelectivityMode.Disabled };
            case String(SelectivityMode.ReadOnly):
                return { enabled: SelectivityMode.ReadOnly };
            case String(SelectivityMode.WriteOnly):
                return { enabled: SelectivityMode.WriteOnly };
        }
    }

    return {};
};
