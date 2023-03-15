"use strict";

const { validateUnknownBrowsers } = require("src/validators");
const logger = require("src/utils/logger");

describe("validators", () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    describe("validateUnknownBrowsers", () => {
        beforeEach(() => {
            sandbox.stub(logger, "warn");
        });

        it("should warn about unknown browsers", () => {
            validateUnknownBrowsers(["foo"], ["bar", "baz"]);

            assert.calledWith(
                logger.warn,
                sinon.match(/Unknown browser ids: foo(.+) specified in the config file: bar, baz/),
            );
        });

        it("should not warn if all browsers are known", () => {
            validateUnknownBrowsers(["foo"], ["foo", "bar"]);

            assert.notCalled(logger.warn);
        });

        it("should warn only about unknown browsers", () => {
            validateUnknownBrowsers(["foo", "bar", "baz"], ["baz", "qux"]);

            assert.calledWith(logger.warn, sinon.match(/Unknown browser ids: foo, bar\./));
        });
    });
});
