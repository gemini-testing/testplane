import assert from "node:assert";

const { value } = require("./helpers/value");

describe("ts-cjs", () => {
    it("ts-cjs test", () => assert.equal(value, "ts-cjs-value"));
});
