"use strict";

const TestSkipper = require("src/test-reader/test-skipper");
const logger = require("src/utils/logger");

describe("test-skipper", () => {
    const sandbox = sinon.sandbox.create();

    const mkTestSkipper = config => new TestSkipper(config || {});

    beforeEach(() => {
        sandbox.stub(logger, "warn");
    });

    afterEach(() => {
        delete process.env.HERMIONE_SKIP_BROWSERS;

        sandbox.restore();
    });

    describe("constructor", () => {
        it("should warn about unknown browsers in the environment variable", () => {
            process.env.HERMIONE_SKIP_BROWSERS = "b3";

            mkTestSkipper({ browsers: { b1: {}, b2: {} } });

            assert.calledWith(
                logger.warn,
                sinon.match(/Unknown browser ids: b3(.+) specified in the config file: b1, b2/),
            );
        });
    });

    describe("shouldBeSkipped", () => {
        it("should be false if HERMIONE_SKIP_BROWSERS environment variable is not specified", () => {
            const testSkipper = mkTestSkipper();

            assert.isFalse(testSkipper.shouldBeSkipped("foo"));
        });

        it("should be true if browser is in HERMIONE_SKIP_BROWSERS environment variable", () => {
            process.env.HERMIONE_SKIP_BROWSERS = "foo";

            const testSkipper = mkTestSkipper({ browsers: { foo: {}, bar: {} } });

            assert.isTrue(testSkipper.shouldBeSkipped("foo"));
        });

        it("should be false for browsers which are not in the environment variable", () => {
            process.env.HERMIONE_SKIP_BROWSERS = "bar";

            const testSkipper = mkTestSkipper({ browsers: { foo: {}, bar: {} } });

            assert.isFalse(testSkipper.shouldBeSkipped("foo"));
        });

        it("should correctly split the environment variable", () => {
            process.env.HERMIONE_SKIP_BROWSERS = "foo,bar";

            const testSkipper = mkTestSkipper({ browsers: { foo: {}, bar: {} } });

            assert.isTrue(testSkipper.shouldBeSkipped("foo"));
            assert.isTrue(testSkipper.shouldBeSkipped("bar"));
        });

        it("should correctly split the environment variable which contains spaces", () => {
            process.env.HERMIONE_SKIP_BROWSERS = "foo, bar";

            const testSkipper = mkTestSkipper({ browsers: { foo: {}, bar: {} } });

            assert.isTrue(testSkipper.shouldBeSkipped("foo"));
            assert.isTrue(testSkipper.shouldBeSkipped("bar"));
        });
    });

    describe("getSuiteDecorator", () => {
        it("should return decorator which skips suite with clear reason", () => {
            const decorator = mkTestSkipper().getSuiteDecorator();

            const skip = sinon.stub().named("skip");
            decorator({ skip });

            assert.calledOnceWith(skip, { reason: sinon.match("HERMIONE_SKIP_BROWSERS") });
        });
    });
});
