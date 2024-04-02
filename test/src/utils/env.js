const env = require("src/utils/env");

describe("env-utils", () => {
    describe("parseCommaSeparatedValue", () => {
        afterEach(() => {
            delete process.env.foo;
        });

        it("should parse comma seperated env value", () => {
            process.env.foo = "a, b,c";

            const { key, value } = env.parseCommaSeparatedValue("foo");
            assert.deepEqual(value, ["a", "b", "c"]);
            assert.equal(key, "foo");
        });

        it("should fallback to other env keys", () => {
            process.env.foo = "a, b,c";

            const { key, value } = env.parseCommaSeparatedValue(["bar", "foo"]);
            assert.deepEqual(value, ["a", "b", "c"]);
            assert.equal(key, "foo");
        });
    });
});
