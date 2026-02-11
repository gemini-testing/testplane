import { assert } from "chai";
import {
    SERIALIZED_ERROR_MARKER,
    deserializeWorkerError,
    serializeWorkerError,
} from "src/utils/worker-error-serialization";

describe("worker-error-serialization", () => {
    it("should create serialized error envelope", () => {
        const error = new Error("boom");

        const serialized = serializeWorkerError(error) as Record<string, unknown>;

        assert.equal(serialized[SERIALIZED_ERROR_MARKER], true);
        assert.equal(serialized.message, "boom");
        assert.equal(serialized.name, "Error");
    });

    it("should round-trip message and custom field", () => {
        const error = Object.assign(new Error("boom"), { code: "E_BROKEN" });

        const deserialized = deserializeWorkerError(serializeWorkerError(error)) as Error & { code: string };

        assert.instanceOf(deserialized, Error);
        assert.equal(deserialized.message, "boom");
        assert.equal(deserialized.code, "E_BROKEN");
    });

    it("should restore nested causes", () => {
        const error = new Error("outer", { cause: new Error("inner", { cause: new Error("root") }) });

        const deserialized = deserializeWorkerError(serializeWorkerError(error)) as Error & {
            cause: Error & { cause: Error };
        };

        assert.equal(deserialized.cause.message, "inner");
        assert.equal(deserialized.cause.cause.message, "root");
        assert.isFalse(Object.getOwnPropertyDescriptor(deserialized, "cause")?.enumerable ?? true);
    });

    it("should keep original error name", () => {
        const error = new TypeError("wrong");

        const deserialized = deserializeWorkerError(serializeWorkerError(error)) as Error;

        assert.instanceOf(deserialized, Error);
        assert.equal(deserialized.name, "TypeError");
        assert.isFalse(Object.keys(deserialized).includes("name"));
    });

    it("should round-trip non-error values", () => {
        const value = { reason: "broken", nested: { retry: false } };

        const deserialized = deserializeWorkerError(serializeWorkerError(value));

        assert.deepEqual(deserialized, value);
    });

    it("should replace circular references", () => {
        const details: Record<string, unknown> = {};
        details.self = details;
        const error = Object.assign(new Error("boom"), { details });

        const serialized = serializeWorkerError(error) as Record<string, Record<string, unknown>>;

        assert.equal(serialized.details.self, "[Circular]");
    });

    it("should return input as-is for plain objects on deserialize", () => {
        const value = { foo: "bar" };

        const deserialized = deserializeWorkerError(value);

        assert.strictEqual(deserialized, value);
    });

    it("should serialize and deserialize buffers", () => {
        const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
        const error = Object.assign(new Error("buffer error"), { data: buffer });

        const deserialized = deserializeWorkerError(serializeWorkerError(error)) as Error & { data: Buffer };

        assert.instanceOf(deserialized, Error);
        assert.instanceOf(deserialized.data, Buffer);
        assert.deepEqual(deserialized.data, buffer);
        assert.equal(deserialized.data.toString(), "Hello");
    });
});
