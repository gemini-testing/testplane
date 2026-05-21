import assert from "node:assert";
import { value } from "./helpers/value.ts";

describe("ts-esm", () => {
    it("ts-esm test", () => assert.equal(value, "ts-esm-value"));
});
