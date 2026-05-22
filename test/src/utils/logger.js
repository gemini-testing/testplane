"use strict";

const logger = require("src/utils/logger");

describe("utils/logger", () => {
    ["log", "warn", "error"].forEach(logFnName => {
        describe(logFnName, () => {
            const sandbox = sinon.createSandbox();

            beforeEach(() => {
                sandbox.spy(console, logFnName);
            });

            afterEach(() => {
                sandbox.restore();
            });

            it("should start with timestamp message", () => {
                logger[logFnName]("message", "another message");

                assert.calledOnce(console[logFnName]);
                assert.match(console[logFnName].firstCall.args[0], /^\[\d{2}:\d{2}:\d{2} [+-]\d{4}\]$/);
                assert.deepEqual(console[logFnName].firstCall.args.slice(1), ["message", "another message"]);
            });
        });
    });
});
