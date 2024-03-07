"use strict";

const logger = require("src/utils/logger");

describe("utils/logger", () => {
    ["log", "warn", "error"].forEach(logFnName => {
        describe(logFnName, () => {
            let clock;
            const sandbox = sinon.createSandbox();
            const originalTZ = process.env.TZ;

            beforeEach(() => {
                sandbox.spy(console, logFnName);
                clock = sinon.useFakeTimers({
                    now: new Date("2023-03-02T14:21:04.000+03:00"),
                });
                process.env.TZ = "Europe/Moscow";
            });

            afterEach(() => {
                clock.restore();
                sandbox.restore();
                process.env.TZ = originalTZ;
            });

            it("should start with timestamp message", () => {
                logger[logFnName]("message", "another message");

                assert.calledOnceWith(console[logFnName], "[14:21:04 +0300]", "message", "another message");
            });
        });
    });
});
