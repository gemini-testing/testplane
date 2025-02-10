"use strict";

const proxyquire = require("proxyquire");

describe("validators", () => {
    const sandbox = sinon.createSandbox();
    let validateUnknownBrowsers;
    let loggerWarnStub;

    beforeEach(() => {
        loggerWarnStub = sandbox.stub();

        validateUnknownBrowsers = proxyquire("src/validators", {
            "./utils/logger": {
                warn: loggerWarnStub,
            },
        }).validateUnknownBrowsers;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("validateUnknownBrowsers", () => {
        it("should warn about unknown browsers", () => {
            validateUnknownBrowsers(["foo"], ["bar", "baz"]);

            assert.calledWith(
                loggerWarnStub,
                sinon.match(/Unknown browser ids: foo(.+) specified in the config file: bar, baz/),
            );
        });

        it("should not warn if all browsers are known", () => {
            validateUnknownBrowsers(["foo"], ["foo", "bar"]);

            assert.notCalled(loggerWarnStub);
        });

        it("should warn only about unknown browsers", () => {
            validateUnknownBrowsers(["foo", "bar", "baz"], ["baz", "qux"]);

            assert.calledWith(loggerWarnStub, sinon.match(/Unknown browser ids: foo, bar\./));
        });
    });
});
