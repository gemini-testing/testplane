import assert from "node:assert";
import { value } from "./helpers/value.js";

describe("js-esm", () => {
    it("js-esm test", () => assert.equal(value, "js-esm-value"));
});
