"use strict";

const SequenceTestParser = require("src/worker/runner/sequence-test-parser");
const SimpleTestParser = require("src/worker/runner/simple-test-parser");
const RunnerEvents = require("src/worker/constants/runner-events");
const { makeConfigStub, makeTest } = require("../../../utils");
const Promise = require("bluebird");

describe("worker/runner/sequence-test-parser", () => {
    const sandbox = sinon.sandbox.create();

    const mkSequenceParser_ = (opts = {}) => {
        const config = opts.config || makeConfigStub();
        return SequenceTestParser.create(config);
    };

    beforeEach(() => {
        sandbox.stub(SimpleTestParser, "create").returns(Object.create(SimpleTestParser.prototype));
        sandbox.stub(SimpleTestParser.prototype, "parse").resolves([]);
    });

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        it("should create simple test parser", () => {
            const config = makeConfigStub();

            mkSequenceParser_({ config });

            assert.calledOnceWith(SimpleTestParser.create, config);
        });
    });

    describe("parse", () => {
        ["BEFORE_FILE_READ", "AFTER_FILE_READ"].forEach(event => {
            it(`should passthrough ${event} event from inner test parser`, async () => {
                const onEvent = sinon.spy().named(`on${event}`);
                const sequenceParser = mkSequenceParser_().on(RunnerEvents[event], onEvent);

                SimpleTestParser.prototype.parse.callsFake(function () {
                    this.emit(RunnerEvents[event], { foo: "bar" });
                    return Promise.resolve([]);
                });

                await sequenceParser.parse({});

                assert.calledOnceWith(onEvent, { foo: "bar" });
            });
        });

        it("should return parsed tests", async () => {
            const sequenceParser = mkSequenceParser_();
            const tests = [makeTest(), makeTest()];
            SimpleTestParser.prototype.parse.resolves(tests);

            const result = await sequenceParser.parse({});

            assert.deepEqual(result, tests);
        });

        it("should parse tests sequentially", async () => {
            const calls = [];

            SimpleTestParser.prototype.parse.callsFake(async () => {
                calls.push("parse");
                await Promise.delay(1);
                calls.push("afterParse");

                return [];
            });

            const sequenceParser = mkSequenceParser_();

            await Promise.all([sequenceParser.parse({}), sequenceParser.parse({})]);

            assert.deepEqual(calls, ["parse", "afterParse", "parse", "afterParse"]);
        });
    });
});
