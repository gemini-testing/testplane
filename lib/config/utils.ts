import _ from 'lodash';
import path from 'path';

export const is = (type: string, name: string) => {
    return (value: unknown): void => {
        if (typeof value !== type) {
            throw new Error(`"${name}" must be a ${type}`);
        }
    };
};

function isNumber(value: unknown, name: string): asserts value is number {
    is('number', name)(value);
}

export const assertNonNegativeNumber = (value: unknown, name: string): asserts value is number => {
    isNumber(value, name);

    if (value < 0) {
        throw new Error(`"${name}" must be non-negative`);
    }
};

export const assertOptionalObject = (value: unknown, name: string): asserts value is object | null => {
    if (!_.isNull(value) && !_.isPlainObject(value)) {
        throw new Error(`"${name}" must be an object`);
    }
};

export const assertOptionalArray = (value: unknown, name: string): asserts value is Array<any> => {
    if (!_.isArray(value)) {
        throw new Error(`"${name}" must be an array`);
    }
};

const isInteger = (value: unknown): value is number => {
    return Number.isInteger(value);
}

export const assertNonNegativeInteger = (value: unknown, name: string): asserts value is number => {
    if (!isInteger(value) || value < 0) {
        throw new Error(`"${name}" must be a non-negative integer`);
    }
};

export const assertPositiveInteger = (value: unknown, name: string): asserts value is number => {
    if (!isInteger(value) || value <= 0) {
        throw new Error(`"${name}" must be a positive integer`);
    }
};

export const assertPositiveIntegerOrInfinity = (value: unknown, name: string): asserts value is number => {
    if ((!isInteger(value) || value <= 0) && value !== Infinity) {
        throw new Error(`"${name}" must be a positive integer or Infinity`);
    }
};

export const parseBoolean = (value: string, name: string): boolean => {
    switch (value.toLowerCase()) {
        case '1':
        case 'yes':
        case 'true':
            return true;
        case '0':
        case 'no':
        case 'false':
            return false;
        default:
            throw new Error(`Unexpected value for boolean option "${name}"`);
    }
};

export const parsePrimitive = (str: string): any => {
    try {
        return JSON.parse(str);
    } catch (error) {
        throw new Error('a value must be a primitive type');
    }
};

export const resolveWithProjectDir = (value: string): string => value ? path.resolve(process.cwd(), value) : value;
