import path from "node:path";
import _ from "lodash";

export const is = (type, name) => {
    return value => {
        if (typeof value !== type) {
            throw new Error(`"${name}" must be a ${type}`);
        }
    };
};

export const assertNonNegativeNumber = (value, name) => {
    is("number", name)(value);
    if (value < 0) {
        throw new Error(`"${name}" must be non-negative`);
    }
};

export const assertOptionalObject = (value, name) => {
    if (!_.isNull(value) && !_.isPlainObject(value)) {
        throw new Error(`"${name}" must be an object`);
    }
};

export const assertOptionalArray = (value, name) => {
    if (!_.isArray(value)) {
        throw new Error(`"${name}" must be an array`);
    }
};

export const assertNonNegativeInteger = (value, name) => {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`"${name}" must be a non-negative integer`);
    }
};

export const assertEnum = (enumValues, value, name) => {
    is("string", name)(value);

    if (!_.includes(enumValues, value)) {
        throw new Error(`"${name}" must be one of: ${enumValues.join(", ")}`);
    }
};

const isPositiveInteger = value => Number.isInteger(value) && value > 0;

export const assertPositiveInteger = (value, name) => {
    if (!isPositiveInteger(value)) {
        throw new Error(`"${name}" must be a positive integer`);
    }
};

export const assertPositiveIntegerOrInfinity = (value, name) => {
    if (!isPositiveInteger(value) && value !== Infinity) {
        throw new Error(`"${name}" must be a positive integer or Infinity`);
    }
};

export const parseBoolean = (value, name) => {
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

export const parsePrimitive = str => {
    try {
        return JSON.parse(str);
    } catch (error) {
        throw new Error("a value must be a primitive type");
    }
};

export const resolveWithProjectDir = value => (value ? path.resolve(process.cwd(), value) : value);
