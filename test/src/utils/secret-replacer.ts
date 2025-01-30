import util from "node:util";
import { utilInspectSafe } from "../../../src/utils/secret-replacer";

describe("utilInspectSafe", () => {
    describe("String Inputs", () => {
        it("should replace OAuth Key patterns", () => {
            const input = "OAuth abcdefghijklmnopqrstuvwxyz012345";

            const result = utilInspectSafe(input);

            assert.equal(result, util.inspect("<OAUTH_KEY>"));
        });

        it("should replace multiple patterns in a single string", () => {
            const input = "Bearer abcdefghijklmnopqrstuvwxyz012345 OAuth xyz0123456789abcdefghijklmnopqrstuvwxyz012";

            const result = utilInspectSafe(input);

            assert.equal(result, util.inspect("<BEARER_TOKEN> <OAUTH_KEY>"));
        });
    });

    describe("Object Inputs", () => {
        it("should recursively replace secrets in nested objects", () => {
            const input = {
                token: "Bearer abcdefghijklmnopqrstuvwxyz012345",
                user: {
                    apiKey: "sk_live_abcdefghijklmnopqrstuvwx",
                    metadata: {
                        refreshToken: "refresh_token_abcdefghijklmnopqrstuvwxyz012345",
                    },
                },
            };

            const result = utilInspectSafe(input);

            assert.deepEqual(
                result,
                util.inspect({
                    token: "<BEARER_TOKEN>",
                    user: {
                        apiKey: "<STRIPE_LIVE_API_KEY>",
                        metadata: {
                            refreshToken: "<REFRESH_TOKEN>",
                        },
                    },
                }),
            );
        });

        it("should handle objects with mixed data types", () => {
            const input = {
                id: 123,
                secret: "AKIAIOSFODNN7EXAMPLE",
                isActive: true,
                details: {
                    token: "Bearer abcdefghijklmnopqrstuvwxyz012345",
                },
            };

            const result = utilInspectSafe(input);

            assert.deepEqual(
                result,
                util.inspect({
                    id: 123,
                    secret: "<AWS_ACCESS_KEY>",
                    isActive: true,
                    details: {
                        token: "<BEARER_TOKEN>",
                    },
                }),
            );
        });
    });

    describe("Array Inputs", () => {
        it("should replace secrets in an array of strings", () => {
            const input = ["Bearer abcdefghijklmnopqrstuvwxyz012345", "OAuth xyz0123456789abcdefghijklmnopqrstuvwxyz"];

            const result = utilInspectSafe(input);

            assert.deepEqual(
                result.replaceAll(/\s/g, ""),
                util.inspect(["<BEARER_TOKEN>", "<OAUTH_KEY>"]).replaceAll(/\s/g, ""),
            );
        });

        it("should recursively replace secrets in an array of objects", () => {
            const input = [
                { token: "Bearer abcdefghijklmnopqrstuvwxyz012345" },
                { apiKey: "sk_live_abcdefghijklmnopqrstuvwx" },
            ];

            const result = utilInspectSafe(input);

            assert.deepEqual(
                result.replaceAll(/\s/g, ""),
                util.inspect([{ token: "<BEARER_TOKEN>" }, { apiKey: "<STRIPE_LIVE_API_KEY>" }]).replaceAll(/\s/g, ""),
            );
        });
    });

    describe("Edge Cases", () => {
        it("should return null for null input", () => {
            const input = null;

            assert.equal(utilInspectSafe(input), util.inspect(input));
        });

        it("should return undefined for undefined input", () => {
            const input = undefined;

            assert.equal(utilInspectSafe(input), util.inspect(input));
        });

        it("should handle empty strings and objects", () => {
            const input1 = "";
            const input2 = {};

            assert.equal(utilInspectSafe(input1), util.inspect(input1));
            assert.equal(utilInspectSafe(input2), util.inspect(input2));
        });
    });
});
