import { getCliArgs } from "../../../../../src/browser-installer/ubuntu-packages/collect-dependencies/utils";

describe("browser-installer/ubuntu-packages/collect-dependencies/utils", () => {
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
