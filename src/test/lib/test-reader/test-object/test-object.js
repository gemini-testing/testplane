"use strict";

const { TestObject } = require("lib/test-reader/test-object/test-object");

describe("test-reader/test-object/test-object", () => {
    describe("title", () => {
        it("should return object title", () => {
            const obj = new TestObject({ title: "foo bar" });

            assert.equal(obj.title, "foo bar");
        });

        it("should not be able to be overwritten", () => {
            const obj = new TestObject({ title: "foo bar" });

            assert.throws(() => obj.title = "baz qux");
        });
    });

    describe("fullTitle", () => {
        it("should return title if no parent", () => {
            const obj = new TestObject({ title: "foo bar" });

            assert.equal(obj.fullTitle(), "foo bar");
        });

        it("should return empty string if title not set", () => {
            const obj = new TestObject({});

            assert.equal(obj.fullTitle(), "");
        });

        it("should return include parent full title", () => {
            const obj = new TestObject({ title: "baz qux" });
            obj.parent = new TestObject({});
            sinon.stub(obj.parent, "fullTitle").returns("foo bar");

            assert.equal(obj.fullTitle(), "foo bar baz qux");
        });

        it("should have no spaces at the beginning if parent has no title", () => {
            const obj = new TestObject({ title: "foo bar" });
            obj.parent = new TestObject({});
            sinon.stub(obj.parent, "fullTitle").returns("");

            assert.equal(obj.fullTitle(), "foo bar");
        });

        it("should have no spaces at the end if object has no title", () => {
            const obj = new TestObject({});
            obj.parent = new TestObject({});
            sinon.stub(obj.parent, "fullTitle").returns("foo bar");

            assert.equal(obj.fullTitle(), "foo bar");
        });
    });
});
