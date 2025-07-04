"use strict";

const { normalizeCommandArgs, runWithHooks, isGroup } = require("src/browser/history/utils");
const { promiseDelay } = require("../../../../src/utils/promise");

describe("commands-history", () => {
    describe("utils", () => {
        describe("normalizeCommandArgs", () => {
            it("should return representation for an object", () => {
                assert.deepEqual(normalizeCommandArgs("click", [{ some: "data" }]), ["{ some: 'data' }"]);
            });

            it("should handle large objects", () => {
                const largeObject = {
                    some: {
                        nested: {
                            data: "data",
                        },
                    },
                    field: "value",
                    array: [1, 2, 3, 4, { some: "data" }],
                    longString: "abc".repeat(100),
                };

                assert.deepEqual(normalizeCommandArgs("click", [largeObject]), [
                    "{ some: [Object], field: 'value', array: [Array...",
                ]);
            });

            it('should return truncated representation for the "execute" command', () => {
                assert.deepEqual(normalizeCommandArgs("execute", []), ["code"]);
            });

            it("should truncate string", () => {
                const arg = "more then 50 characters string string string string";

                assert.deepEqual(normalizeCommandArgs("click", [arg]), [
                    "more then 50 characters string string string st...",
                ]);
            });

            it("should convert argument to string if it is not string or object", () => {
                assert.deepEqual(normalizeCommandArgs("click", [false, null, 100]), ["false", "null", "100"]);
            });

            it("should return 'promise' for promise arguments", () => {
                const promiseArg = Promise.resolve("test");

                assert.deepEqual(normalizeCommandArgs("click", [promiseArg]), ["promise"]);
            });

            it("should return 'unknown' if error occurs during argument normalization", () => {
                const problematicArg = Object.create({
                    toString: () => {
                        throw new Error("Cannot convert to string");
                    },
                });

                assert.deepEqual(normalizeCommandArgs("click", [problematicArg]), ["unknown"]);
            });
        });

        describe("runWithHooks", () => {
            let clock;
            let tick;

            beforeEach(() => {
                clock = sinon.useFakeTimers();
                tick = async ms => {
                    clock.tick(ms);
                    return Promise.resolve();
                };
            });

            afterEach(() => {
                clock.restore();
            });

            describe('should run hooks and a target in correct sequence if "fn" is', () => {
                it("NOT a promise", async () => {
                    const before = sinon.stub();
                    const fn = sinon.stub().callsFake(() => "some");
                    const after = sinon.stub();

                    runWithHooks({ fn, before, after });

                    assert.called(before);
                    assert.called(fn);
                    assert.called(after);
                });

                it("a promise", async () => {
                    const before = sinon.stub();
                    const fn = sinon.stub().callsFake(() => promiseDelay(1000));
                    const after = sinon.stub();

                    runWithHooks({ fn, before, after });

                    assert.called(before);
                    assert.called(fn);
                    assert.notCalled(after);

                    await tick(1000);

                    assert.called(after);
                });
            });

            it("should run hooks even if a target throws an error", async () => {
                const before = sinon.stub();
                const after = sinon.stub();
                const fn = sinon.stub().callsFake(() => {
                    throw new Error("target");
                });

                assert.throws(() => runWithHooks({ fn, before, after }));
                assert.called(before);
                assert.called(fn);
                assert.called(after);
            });

            it("should run hooks even if a target has rejected", async () => {
                const before = sinon.stub();
                const after = sinon.stub();
                const fn = sinon.stub().callsFake(async () => {
                    throw new Error("target");
                });

                const prom = runWithHooks({ fn, before, after });

                await assert.isRejected(prom);
                assert.called(before);
                assert.called(fn);
                assert.called(after);
            });

            it("should return a result of a target", async () => {
                const before = sinon.stub();
                const after = sinon.stub();
                const fn = sinon
                    .stub()
                    .callsFake(() => new Promise(resolve => setTimeout(() => resolve("result"), 1000)));

                let res = runWithHooks({ fn, before, after });

                await tick(1000);

                assert.equal(await res, "result");
            });
        });

        describe("isGroup", () => {
            let mkNode;

            beforeEach(() => {
                mkNode = ({ name, isGroup }) => ({ n: name, g: isGroup });
            });

            it('should return "true"', () => {
                const node = mkNode({ name: "foo", isGroup: true });

                assert.isTrue(isGroup(node));
            });

            it('should return "false"', () => {
                const node = mkNode({ name: "foo" });

                assert.isFalse(isGroup(node));
            });
        });
    });
});
