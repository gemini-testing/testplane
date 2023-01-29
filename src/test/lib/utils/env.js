const env = require("lib/utils/env");

describe("env-utils", () => {
    describe("parseCommaSeparatedValue", () => {
        afterEach(() => {
            delete process.env.foo;
        });

        it("should parse comma seperated env value", () => {
            process.env.foo = "a, b,c";

            assert.deepEqual(env.parseCommaSeparatedValue("foo"), ["a", "b", "c"]);
        });
    });
});
