"use strict";

const RuntimeConfig = require("src/config/runtime-config");

describe("RuntimeConfig", () => {
    it("should be a singleton instance", () => {
        const runtimeConfig1 = RuntimeConfig.getInstance();
        const runtimeConfig2 = RuntimeConfig.getInstance();

        assert.strictEqual(runtimeConfig1, runtimeConfig2);
    });
});
