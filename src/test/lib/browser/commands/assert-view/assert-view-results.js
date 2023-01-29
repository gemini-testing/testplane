"use strict";

const AssertViewResults = require("lib/browser/commands/assert-view/assert-view-results");
const ImageDiffError = require("lib/browser/commands/assert-view/errors/image-diff-error");
const NoRefImageError = require("lib/browser/commands/assert-view/errors/no-ref-image-error");

describe("AssertViewResults", () => {
    describe("fromRawObject", () => {
        it("should create an instance form a raw object", () => {
            const obj = [
                { name: ImageDiffError.name },
                { name: NoRefImageError.name },
                { foo: "bar" },
            ];

            const results = AssertViewResults.fromRawObject(obj).get();

            assert.instanceOf(results[0], ImageDiffError);
            assert.instanceOf(results[1], NoRefImageError);
            assert.deepEqual(results[2], { foo: "bar" });
        });
    });

    describe("add", () => {
        it("should add data", () => {
            const assertViewResults = AssertViewResults.create();

            assertViewResults.add({ foo: "bar" });
            assertViewResults.add({ baz: "qux" });

            assert.deepEqual(assertViewResults.get(), [
                { foo: "bar" },
                { baz: "qux" },
            ]);
        });
    });

    describe("hasFails", () => {
        it('should return "false" in case of fails', () => {
            const assertViewResults = AssertViewResults.create();

            assertViewResults.add({ foo: "bar" });
            assertViewResults.add({ baz: "qux" });

            assert.isFalse(assertViewResults.hasFails());
        });

        it('should return "true" in case of no fails', () => {
            const assertViewResults = AssertViewResults.create();

            assertViewResults.add({ foo: "bar" });
            assertViewResults.add(new Error());

            assert.isTrue(assertViewResults.hasFails());
        });
    });

    describe("hasState", () => {
        it('should return "true" if state exists', () => {
            const assertViewResults = AssertViewResults.create();

            assertViewResults.add({ stateName: "foo" });
            assertViewResults.add({ stateName: "bar" });

            assert.isTrue(assertViewResults.hasState("foo"));
            assert.isTrue(assertViewResults.hasState("bar"));
        });

        it('should return "false" if state does not exist', () => {
            const assertViewResults = AssertViewResults.create();

            assertViewResults.add({ stateName: "foo" });
            assertViewResults.add({ stateName: "bar" });

            assert.isFalse(assertViewResults.hasState("baz"));
            assert.isFalse(assertViewResults.hasState("qux"));
        });
    });

    describe("toRawObject", () => {
        it("should transform result to raw object", () => {
            const assertViewResults = AssertViewResults.create();
            const err = new Error();
            err.name = "some error";

            assertViewResults.add({ foo: "bar" });
            assertViewResults.add(err);

            assert.deepEqual(assertViewResults.toRawObject(), [
                { foo: "bar" },
                { name: "some error" },
            ]);
        });
    });
});
