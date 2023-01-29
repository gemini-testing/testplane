"use strict";

const { Test } = require("lib/test-reader/test-object");
const { ConfigurableTestObject } = require("lib/test-reader/test-object/configurable-test-object");

describe("test-reader/test-object/test", () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    it("should be an instance of configurable test object", () => {
        const test = new Test({});

        assert.instanceOf(test, ConfigurableTestObject);
    });

    describe("create", () => {
        it("should create Test object", () => {
            const test = Test.create({});

            assert.instanceOf(test, Test);
        });
    });

    describe("constructor", () => {
        before(() => {
            const stub = sandbox.stub();
            Object.setPrototypeOf(stub, Object.getPrototypeOf(Test));
            Object.setPrototypeOf(Test, stub);
        });

        after(() => {
            Object.setPrototypeOf(Test, Object.getPrototypeOf(Object.getPrototypeOf(Test)));
        });

        afterEach(() => {
            sandbox.reset();
        });

        it("should pass base properties to base class constructor", () => {
            const title = "foo bar";
            const file = "baz/qux.js";
            const id = "bazqux";

            new Test({ title, file, id });

            assert.calledWithMatch(Object.getPrototypeOf(Test), { title, file, id });
        });
    });

    describe("type", () => {
        it('should be "test"', () => {
            const test = new Test({});

            assert.equal(test.type, "test");
        });
    });
});
