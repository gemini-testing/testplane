"use strict";

const CachingTestParser = require("src/worker/runner/caching-test-parser");
const SequenceTestParser = require("src/worker/runner/sequence-test-parser");
const { WorkerEvents: RunnerEvents } = require("src/events");
const { TestCollection } = require("src/test-collection");
const { makeConfigStub, makeTest } = require("../../../utils");

describe("worker/runner/caching-test-parser", () => {
    const sandbox = sinon.createSandbox();

    const mkCachingParser_ = (opts = {}) => {
        const config = opts.config || makeConfigStub();
        return CachingTestParser.create(config);
    };

    beforeEach(() => {
        sandbox.stub(SequenceTestParser, "create").returns(Object.create(SequenceTestParser.prototype));
        sandbox.stub(SequenceTestParser.prototype, "parse").resolves([]);
    });

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        it("should create sequnce test parser", () => {
            const config = makeConfigStub();

            mkCachingParser_({ config });

            assert.calledOnceWith(SequenceTestParser.create, config);
        });
    });

    describe("parse", () => {
        ["BEFORE_FILE_READ", "AFTER_FILE_READ"].forEach(event => {
            it(`should passthrough ${event} event from seqeunce test parser`, async () => {
                const onEvent = sinon.spy().named(`on${event}`);
                const cachingParser = mkCachingParser_().on(RunnerEvents[event], onEvent);

                SequenceTestParser.prototype.parse.callsFake(function () {
                    this.emit(RunnerEvents[event], { foo: "bar" });
                    return Promise.resolve([]);
                });

                await cachingParser.parse({});

                assert.calledOnceWith(onEvent, { foo: "bar" });
            });
        });

        it("should return parsed tests", async () => {
            const cachingParser = mkCachingParser_();
            const tests = [makeTest(), makeTest()];
            SequenceTestParser.prototype.parse.resolves(tests);

            const result = await cachingParser.parse({});

            assert.deepEqual(result, tests);
        });

        it("should parse each file in each browser only once (sequential requests)", async () => {
            const cachingParser = mkCachingParser_();
            const tests = [makeTest(), makeTest()];
            SequenceTestParser.prototype.parse.resolves(tests);

            await cachingParser.parse({ file: "some/file.js", browserId: "bro" });
            const result = await cachingParser.parse({ file: "some/file.js", browserId: "bro" });

            assert.deepEqual(result, tests);
            assert.calledOnce(SequenceTestParser.prototype.parse);
        });

        it("should parse each file in each browser only once (parallel requests)", async () => {
            const cachingParser = mkCachingParser_();
            const tests = [makeTest(), makeTest()];
            SequenceTestParser.prototype.parse.resolves(tests);

            const promise1 = cachingParser.parse({ file: "some/file.js", browserId: "bro" });
            const promise2 = cachingParser.parse({ file: "some/file.js", browserId: "bro" });

            const [tests1, tests2] = await Promise.all([promise1, promise2]);

            assert.deepEqual(tests1, tests2);
            assert.deepEqual(tests2, tests);
            assert.calledOnce(SequenceTestParser.prototype.parse);
        });

        it("should parse same file in different browsers", async () => {
            const cachingParser = mkCachingParser_();

            await cachingParser.parse({ file: "some/file.js", browserId: "bro1" });
            await cachingParser.parse({ file: "some/file.js", browserId: "bro2" });

            assert.calledTwice(SequenceTestParser.prototype.parse);
        });

        it("should parse different files in same browser", async () => {
            const cachingParser = mkCachingParser_();

            await cachingParser.parse({ file: "some/file.js", browserId: "bro" });
            await cachingParser.parse({ file: "other/file.js", browserId: "bro" });

            assert.calledTwice(SequenceTestParser.prototype.parse);
        });

        it("should emit AFTER_TESTS_READ event on parse", async () => {
            const onAfterTestsRead = sinon.spy().named("onAfterTestsRead");
            const cachingParser = mkCachingParser_().on(RunnerEvents.AFTER_TESTS_READ, onAfterTestsRead);

            await cachingParser.parse({});

            assert.calledOnceWith(onAfterTestsRead, sinon.match.instanceOf(TestCollection));
        });

        it("should create test collection with parsed tests", async () => {
            const cachingParser = mkCachingParser_();
            const tests = [makeTest(), makeTest()];
            SequenceTestParser.prototype.parse.resolves(tests);

            sinon.spy(TestCollection, "create");

            await cachingParser.parse({ browserId: "bro" });

            assert.calledOnceWith(TestCollection.create, { bro: tests });
        });

        it("should emit AFTER_TESTS_READ event only once for each file in each browser", async () => {
            const onAfterTestsRead = sinon.spy().named("onAfterTestsRead");
            const cachingParser = mkCachingParser_().on(RunnerEvents.AFTER_TESTS_READ, onAfterTestsRead);

            await cachingParser.parse({ file: "some/file.js", browserId: "bro" });
            await cachingParser.parse({ file: "some/file.js", browserId: "bro" });

            assert.calledOnce(onAfterTestsRead);
        });

        it("should emit AFTER_TESTS_READ event for the same file in different browsers", async () => {
            const onAfterTestsRead = sinon.spy().named("onAfterTestsRead");
            const cachingParser = mkCachingParser_().on(RunnerEvents.AFTER_TESTS_READ, onAfterTestsRead);

            await cachingParser.parse({ file: "some/file.js", browserId: "bro1" });
            await cachingParser.parse({ file: "some/file.js", browserId: "bro2" });

            assert.calledTwice(onAfterTestsRead);
        });

        it("should emit AFTER_TESTS_READ event for different files in the same browser", async () => {
            const onAfterTestsRead = sinon.spy().named("onAfterTestsRead");
            const cachingParser = mkCachingParser_().on(RunnerEvents.AFTER_TESTS_READ, onAfterTestsRead);

            await cachingParser.parse({ file: "some/file.js", browserId: "bro" });
            await cachingParser.parse({ file: "other/file.js", browserId: "bro" });

            assert.calledTwice(onAfterTestsRead);
        });
    });
});
