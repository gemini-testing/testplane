import { getCliArgs } from "../../../src/collect-ubuntu-browser-dependencies/utils";

describe("collect-ubuntu-browser-dependencies/utils", () => {
    describe("getCliArgs", () => {
        it("should support long cli keys", () => {
            assert.deepEqual(getCliArgs({ foo: true }), ["--foo"]);
        });

        it("should support short cli keys", () => {
            assert.deepEqual(getCliArgs({ f: true }), ["-f"]);
        });

        it("should not return disabled cli keys", () => {
            assert.deepEqual(getCliArgs({ f: false, foo: false }), []);
        });
    });
});
