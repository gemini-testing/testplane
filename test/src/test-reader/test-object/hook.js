"use strict";

const { Suite, Hook } = require("src/test-reader/test-object");
const { TestObject } = require("src/test-reader/test-object/test-object");
const { ConfigurableTestObject } = require("src/test-reader/test-object/configurable-test-object");

describe("test-reader/test-object/hook", () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    it("should be an instance of test object", () => {
        const hook = new Hook({});

        assert.instanceOf(hook, TestObject);
    });

    it("should not be an instance of configurable test object", () => {
        const hook = new Hook({});

        assert.notInstanceOf(hook, ConfigurableTestObject);
    });

    describe("create", () => {
        it("should create Hook object", () => {
            const test = Hook.create({});

            assert.instanceOf(test, Hook);
        });
    });

    describe("constructor", () => {
        before(() => {
            const stub = sandbox.stub();
            Object.setPrototypeOf(stub, Object.getPrototypeOf(Hook));
            Object.setPrototypeOf(Hook, stub);
        });

        after(() => {
            Object.setPrototypeOf(Hook, Object.getPrototypeOf(Object.getPrototypeOf(Hook)));
        });

        afterEach(() => {
            sandbox.reset();
        });

        it("should pass base properties to base class constructor", () => {
            const title = "foo bar";

            new Hook({ title });

            assert.calledWithMatch(Object.getPrototypeOf(Hook), { title });
        });
    });

    describe("clone", () => {
        it("should return an instance of Hook", () => {
            const clonedHook = new Hook({}).clone();

            assert.instanceOf(clonedHook, Hook);
        });

        it("should create object with same own properties", () => {
            const fn = sinon.spy();

            const clonedHook = new Hook({ title: "foo bar", fn });

            assert.equal(clonedHook.fn, fn);
            assert.equal(clonedHook.title, "foo bar");
        });

        it("should assign itself to cloned object", () => {
            sandbox.spy(Hook.prototype, "assign");
            const hook = new Hook({});

            const clonedHook = hook.clone();

            assert.calledOnceWith(Hook.prototype.assign, hook);
            assert.calledOn(Hook.prototype.assign, clonedHook);
        });
    });

    describe("file", () => {
        it("should return parent file", () => {
            const hook = new Hook({});
            const suite = new Suite({ file: "foo/bar.js" });
            hook.parent = suite;

            assert.equal(hook.file, "foo/bar.js");
        });
    });

    describe("timeout", () => {
        it("should return parent timeout", () => {
            const hook = new Hook({});
            const suite = new Suite({});
            hook.parent = suite;

            suite.timeout = 100500;

            assert.equal(hook.timeout, 100500);
        });
    });

    describe("browserId", () => {
        it("should return parent browserId", () => {
            const hook = new Hook({});
            const suite = new Suite({});
            hook.parent = suite;

            suite.browserId = "foo";

            assert.equal(hook.browserId, "foo");
        });
    });
});
