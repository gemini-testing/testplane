"use strict";

const { TestObject } = require("src/test-reader/test-object/test-object");
const { ConfigurableTestObject } = require("src/test-reader/test-object/configurable-test-object");

describe("test-reader/test-object/configurable-test-object", () => {
    const sandbox = sinon.createSandbox();

    const mkObj_ = (opts = {}) => {
        return new ConfigurableTestObject(opts);
    };

    afterEach(() => {
        sandbox.restore();
    });

    it("should be an instance of test object", () => {
        const hook = mkObj_();

        assert.instanceOf(hook, TestObject);
    });

    describe("constructor", () => {
        before(() => {
            const stub = sandbox.stub();
            Object.setPrototypeOf(stub, Object.getPrototypeOf(ConfigurableTestObject));
            Object.setPrototypeOf(ConfigurableTestObject, stub);
        });

        after(() => {
            Object.setPrototypeOf(
                ConfigurableTestObject,
                Object.getPrototypeOf(Object.getPrototypeOf(ConfigurableTestObject)),
            );
        });

        afterEach(() => {
            sandbox.reset();
        });

        it("should pass base properties to the base class constructor", () => {
            const title = "foo bar";

            mkObj_({ title });

            assert.calledWithMatch(Object.getPrototypeOf(ConfigurableTestObject), { title });
        });
    });

    describe("assign", () => {
        it("should return itself", () => {
            const obj = mkObj_();

            assert.equal(obj.assign(mkObj_()), obj);
        });

        it("should call base class assign method", () => {
            sandbox.spy(TestObject.prototype, "assign");
            const src = mkObj_();

            mkObj_().assign(src);

            assert.calledOnceWith(TestObject.prototype.assign, src);
        });

        [
            ["pending", true],
            ["skipReason", "foo bar"],
            ["disabled", true],
            ["silentSkip", true],
            ["timeout", 100500],
            ["browserId", "foo"],
            ["browserVersion", "100500"],
        ].forEach(([property, value]) => {
            it(`should assign ${property} property value`, () => {
                const src = mkObj_();
                src[property] = value;

                const obj = mkObj_().assign(src);

                assert.propertyVal(obj, property, value);
            });
        });
    });

    describe("id", () => {
        it("should return object id", () => {
            const obj = mkObj_({ id: "foo" });

            assert.equal(obj.id, "foo");
        });

        it("should allow to call as a method", () => {
            const obj = mkObj_({ id: "foo" });

            assert.equal(obj.id, "foo");
        });
    });

    describe("file", () => {
        it("should return object file", () => {
            const obj = mkObj_({ file: "foo/bar.js" });

            assert.equal(obj.file, "foo/bar.js");
        });

        it("should not be able to be overwritten", () => {
            const obj = mkObj_({ file: "foo/bar.js" });

            assert.throws(() => (obj.file = "baz/qux.js"));
        });
    });

    describe("skip", () => {
        it("should set pending property", () => {
            const obj = mkObj_();

            obj.skip({});

            assert.isTrue(obj.pending);
        });

        it("should set skip reason", () => {
            const obj = mkObj_();

            obj.skip({ reason: "foo bar" });

            assert.property(obj, "skipReason", "foo bar");
        });
    });

    describe("disable", () => {
        it("should set disabled property", () => {
            const obj = mkObj_();

            obj.disable();

            assert.isTrue(obj.disabled);
        });

        it("should set silentSkip property", () => {
            const obj = mkObj_();

            obj.disable();

            assert.isTrue(obj.silentSkip);
        });
    });

    [
        ["pending", false, true, false],
        ["skipReason", "", "foo bar", "baz qux"],
        ["disabled", false, true, false],
        ["silentSkip", false, true, false],
        ["timeout", 0, 100500, 500100],
        ["browserId", undefined, "foo", "bar"],
        ["browserVersion", undefined, "100500", "500100"],
    ].forEach(([property, defaultValue, testValue, valueToOverwrite]) => {
        describe(property, () => {
            it("should return default value if no parent", () => {
                assert.equal(mkObj_()[property], defaultValue);
            });

            it(`should set ${property}`, () => {
                const obj = mkObj_();

                obj[property] = testValue;

                assert.equal(obj[property], testValue);
            });

            it("should use parent value", () => {
                const obj = mkObj_();
                const parent = mkObj_();
                obj.parent = parent;

                parent[property] = testValue;

                assert.equal(obj[property], testValue);
            });

            it("should use own value if set", () => {
                const obj = mkObj_();
                const parent = mkObj_();
                obj.parent = parent;

                parent[property] = testValue;
                obj[property] = valueToOverwrite;

                assert.equal(obj[property], valueToOverwrite);
            });

            it("should use own value even if it set to default value", () => {
                const obj = mkObj_();
                const parent = mkObj_();
                obj.parent = parent;

                parent[property] = testValue;
                obj[property] = defaultValue;

                assert.equal(obj[property], defaultValue);
            });
        });
    });

    describe("hasBrowserVersionOverwritten", () => {
        it("should not be set by default", () => {
            assert.isFalse(mkObj_().hasBrowserVersionOverwritten);
        });

        it("should be set on browserVersion update", () => {
            const obj = mkObj_();

            obj.browserVersion = "100500";

            assert.isTrue(obj.hasBrowserVersionOverwritten);
        });

        it("should not be set on parent browserVersion update", () => {
            const obj = mkObj_();
            const parent = mkObj_();
            obj.parent = parent;

            parent.browserVersion = "100500";

            assert.isFalse(obj.hasBrowserVersionOverwritten);
        });
    });
});
