import _ from "lodash";
import { ConfigParsed } from "./types";

type ValueType = "string" | "number" | "boolean" | "object" | "undefined" | "function";

export const is = (type: ValueType, name: string) => {
    return (value: unknown): void => {
        if (typeof value !== type) {
            throw new Error(`"${name}" must be a ${type}`);
        }
    };
};

export const assertNonNegativeNumber = (value: number, name: string): void => {
    is("number", name)(value);
    if (value < 0) {
        throw new Error(`"${name}" must be non-negative`);
    }
};

export const assertOptionalObject = (value: unknown, name: string): void => {
    if (!_.isNull(value) && !_.isPlainObject(value)) {
        throw new Error(`"${name}" must be an object`);
    }
};

export const assertOptionalArray = (value: unknown, name: string): void => {
    if (!_.isArray(value)) {
        throw new Error(`"${name}" must be an array`);
    }
};

export const assertNonNegativeInteger = (value: number, name: string): void => {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`"${name}" must be a non-negative integer`);
    }
};

export const assertEnum = (enumValues: string[], value: string, name: string): void => {
    is("string", name)(value);

    if (!_.includes(enumValues, value)) {
        throw new Error(`"${name}" must be one of: ${enumValues.join(", ")}`);
    }
};

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

export const assertPositiveInteger = (value: number, name: string): void => {
    if (!isPositiveInteger(value)) {
        throw new Error(`"${name}" must be a positive integer`);
    }
};

export const assertPositiveIntegerOrInfinity = (value: number, name: string): void => {
    if (!isPositiveInteger(value) && value !== Infinity) {
        throw new Error(`"${name}" must be a positive integer or Infinity`);
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
        default:
            throw new Error(`Unexpected value for boolean option "${name}"`);
    }
};

export const parsePrimitive = <T = unknown>(str: string): T => {
    try {
        return JSON.parse(str);
    } catch (error) {
        throw new Error("a value must be a primitive type");
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
