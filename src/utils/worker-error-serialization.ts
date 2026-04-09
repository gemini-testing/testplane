"use strict";

export const SERIALIZED_ERROR_MARKER = "__testplane_serialized_error__";

const CIRCULAR_REFERENCE_PLACEHOLDER = "[Circular]";
const BASE_ERROR_FIELDS = new Set(["name", "message", "stack"]);
const ENVELOPE_FIELDS = new Set([SERIALIZED_ERROR_MARKER, "isThrownNonError", "value", "message", "stack", "name"]);

type UnknownRecord = Record<string, unknown>;

type SerializedWorkerError = UnknownRecord & {
    [SERIALIZED_ERROR_MARKER]: true;
    isThrownNonError?: true;
    value?: unknown;
    message?: string;
    stack?: string;
    name?: string;
};

const isObject = (value: unknown): value is UnknownRecord => value !== null && typeof value === "object";

const isSerializedWorkerError = (value: unknown): value is SerializedWorkerError =>
    isObject(value) && value[SERIALIZED_ERROR_MARKER] === true;

function serializeValue(value: unknown, traversed: WeakSet<object>): unknown {
    if (Buffer.isBuffer(value)) {
        return { type: "Buffer", data: Array.from(value) };
    }

    if (value instanceof Error) {
        return serializeError(value, traversed);
    }

    if (!isObject(value)) {
        return value;
    }

    if (traversed.has(value)) {
        return CIRCULAR_REFERENCE_PLACEHOLDER;
    }

    traversed.add(value);

    try {
        if (Array.isArray(value)) {
            return value.map(item => serializeValue(item, traversed));
        }

        return Object.keys(value).reduce<UnknownRecord>((result, key) => {
            result[key] = serializeValue(value[key], traversed);

            return result;
        }, {});
    } finally {
        traversed.delete(value);
    }
}

function serializeError(error: Error, traversed: WeakSet<object>): SerializedWorkerError {
    if (traversed.has(error)) {
        return {
            [SERIALIZED_ERROR_MARKER]: true,
            message: error.message,
            stack: error.stack,
            name: error.name,
        };
    }

    traversed.add(error);

    try {
        const serializedError: SerializedWorkerError = {
            [SERIALIZED_ERROR_MARKER]: true,
            message: error.message,
            stack: error.stack,
            name: error.name,
        };

        Object.getOwnPropertyNames(error).forEach(key => {
            if (BASE_ERROR_FIELDS.has(key)) {
                return;
            }

            serializedError[key] = serializeValue((error as unknown as UnknownRecord)[key], traversed);
        });

        return serializedError;
    } finally {
        traversed.delete(error);
    }
}

function deserializeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(deserializeValue);
    }

    if (isSerializedWorkerError(value)) {
        return deserializeWorkerError(value);
    }

    if (!isObject(value)) {
        return value;
    }

    if (value.type === "Buffer" && Array.isArray(value.data)) {
        return Buffer.from(value.data as number[]);
    }

    return Object.keys(value).reduce<UnknownRecord>((result, key) => {
        result[key] = deserializeValue(value[key]);

        return result;
    }, {});
}

export function deserializeWorkerError(value: unknown): unknown {
    if (!isSerializedWorkerError(value)) {
        return value;
    }

    if (value.isThrownNonError) {
        return deserializeValue(value.value);
    }

    const message = typeof value.message === "string" ? value.message : "";
    const cause = Object.prototype.hasOwnProperty.call(value, "cause") ? deserializeValue(value.cause) : undefined;
    const error = cause === undefined ? new Error(message) : new Error(message, { cause });

    if (typeof value.stack === "string") {
        error.stack = value.stack;
    }

    if (typeof value.name === "string" && value.name !== "Error") {
        Object.defineProperty(error, "name", {
            value: value.name,
            configurable: true,
            writable: true,
            enumerable: false,
        });
    }

    Object.keys(value).forEach(key => {
        if (ENVELOPE_FIELDS.has(key) || key === "cause") {
            return;
        }

        (error as unknown as UnknownRecord)[key] = deserializeValue(value[key]);
    });

    return error;
}

export function serializeWorkerError(error: unknown): SerializedWorkerError {
    if (error instanceof Error) {
        return serializeError(error, new WeakSet());
    }

    return {
        [SERIALIZED_ERROR_MARKER]: true,
        isThrownNonError: true,
        value: serializeValue(error, new WeakSet()),
    };
}
