"use strict";

const { BrowserConfig } = require("src/config/browser-config");

describe("BrowserConfig", () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        it("should contain a browser id", () => {
            const config = new BrowserConfig({
                id: "bro",
            });

            assert.equal(config.id, "bro");
        });

        it("should be extended with passed options", () => {
            const config = new BrowserConfig({ foo: "bar" });

            assert.equal(config.foo, "bar");
        });
    });

    describe("getScreenshotPath", () => {
        it("should return full screenshot path for current test state", () => {
            const test = { id: "12345" };
            const config = new BrowserConfig({ id: "bro", screenshotsDir: "scrs" });
            sandbox.stub(process, "cwd").returns("/def/path");

            const res = config.getScreenshotPath(test, "plain");

            assert.equal(res, "/def/path/scrs/12345/bro/plain.png");
        });

        it('should override screenshot path with result of "screenshotsDir" execution if it is function', () => {
            const config = new BrowserConfig({ screenshotsDir: () => "/foo" });
            const res = config.getScreenshotPath({}, "plain");

            assert.equal(res, "/foo/plain.png");
        });
    });

    describe("serialize", () => {
        it("should serialize all props except system options", () => {
            const config = new BrowserConfig({ id: "bro", foo: "bar", system: { baz: "qux" } });

            const result = config.serialize();

            assert.deepEqual(result, { id: "bro", foo: "bar" });
        });
    });
});
