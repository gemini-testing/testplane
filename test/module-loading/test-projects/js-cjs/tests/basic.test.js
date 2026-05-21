"use strict";

const assert = require("node:assert");
const { value } = require("./helpers/value");

describe("js-cjs", () => {
    it("js-cjs test", () => assert.equal(value, "js-cjs-value"));
});
