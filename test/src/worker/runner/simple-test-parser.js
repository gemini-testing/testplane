"use strict";

const { SimpleTestParser } = require("src/worker/runner/simple-test-parser");
const { WorkerEvents: RunnerEvents } = require("src/events");
const { TestParser } = require("src/test-reader/test-parser");
const { makeConfigStub, makeTest } = require("../../../utils");

describe("worker/runner/simple-test-parser", () => {
    const sandbox = sinon.createSandbox();

    const mkSimpleParser_ = (opts = {}) => {
        const config = opts.config || makeConfigStub();
        return SimpleTestParser.create(config);
    };

    beforeEach(() => {
        sandbox.stub(TestParser.prototype, "loadFiles").resolvesThis();
        sandbox.stub(TestParser.prototype, "parse").returns([]);
    });

    afterEach(() => sandbox.restore());

    describe("parse", () => {
        ["BEFORE_FILE_READ", "AFTER_FILE_READ"].forEach(event => {
            it(`should passthrough ${event} event from inner test parser`, async () => {
                const onEvent = sinon.spy().named(`on${event}`);
                const simpleParser = mkSimpleParser_().on(RunnerEvents[event], onEvent);

                TestParser.prototype.parse.callsFake(function () {
                    this.emit(RunnerEvents[event], { foo: "bar" });
                    return [];
                });

                await simpleParser.parse({});

                assert.calledOnceWith(onEvent, { foo: "bar" });
            });
        });

        it("should load file", async () => {
            const config = makeConfigStub();
            const simpleParser = mkSimpleParser_({ config });

            await simpleParser.parse({ file: "some/file.js" });

            assert.calledOnceWith(TestParser.prototype.loadFiles, ["some/file.js"], { config });
        });

        it("should load file before parse", async () => {
            const simpleParser = mkSimpleParser_();

            await simpleParser.parse({});

            assert.callOrder(TestParser.prototype.loadFiles, TestParser.prototype.parse);
        });

        it("should parse tests", async () => {
            const config = makeConfigStub();
            const browserId = "bro";
            const browserConfig = { foo: "bar" };
            config.forBrowser.withArgs(browserId).returns(browserConfig);

            const simpleParser = mkSimpleParser_({ config });

            await simpleParser.parse({ file: "foo.js", browserId });

            assert.calledOnceWith(TestParser.prototype.parse, ["foo.js"], { browserId, config: browserConfig });
        });

        it("should return parsed tests", async () => {
            const simpleParser = mkSimpleParser_();
            const tests = [makeTest(), makeTest()];
            TestParser.prototype.parse.returns(tests);

            const result = await simpleParser.parse({});

            assert.deepEqual(result, tests);
        });
    });
});
