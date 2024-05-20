"use strict";

const { OnlyController } = require("src/test-reader/controllers/only-controller");
const { TreeBuilder } = require("src/test-reader/tree-builder");
const { ConfigurableTestObject } = require("src/test-reader/test-object/configurable-test-object");
const { TestReaderEvents: ReadEvents } = require("src/events");
const { EventEmitter } = require("events");

describe("test-reader/controllers/only-controller", () => {
    const sandbox = sinon.createSandbox();

    const mkController_ = () => {
        const eventBus = new EventEmitter().on(ReadEvents.NEW_BUILD_INSTRUCTION, instruction =>
            instruction({ treeBuilder: new TreeBuilder() }),
        );

        return OnlyController.create(eventBus);
    };

    const mkTestObject_ = ({ browserId } = {}) => {
        const testObject = new ConfigurableTestObject({});
        testObject.browserId = browserId || "default-browser-id";

        return testObject;
    };

    const applyTraps_ = ({ browserId }) => {
        const testObject = mkTestObject_({ browserId });

        for (let i = 0; i < TreeBuilder.prototype.addTrap.callCount; ++i) {
            TreeBuilder.prototype.addTrap.getCall(i).args[0](testObject);
        }
    };

    beforeEach(() => {
        sandbox.stub(TreeBuilder.prototype, "addTrap");

        sandbox.stub(ConfigurableTestObject.prototype, "disable");
    });

    afterEach(() => {
        sandbox.restore();
    });

    [
        ["plain text", str => str],
        ["regular expression", str => new RegExp(str)],
    ].forEach(([description, mkMatcher]) => {
        describe(description, () => {
            describe(".in", () => {
                it("should be chainable", () => {
                    const only = mkController_();

                    const res = only.in(mkMatcher("foo"));

                    assert.equal(res, only);
                });

                describe("trap", () => {
                    it("should be set", () => {
                        mkController_().in(mkMatcher("foo"));

                        assert.calledOnceWith(TreeBuilder.prototype.addTrap, sinon.match.func);
                    });

                    it("should not disable test in case of browser match", () => {
                        mkController_().in(mkMatcher("foo"));

                        applyTraps_({ browserId: "foo" });

                        assert.notCalled(ConfigurableTestObject.prototype.disable);
                    });

                    it("should disable test in case of browser mismatch", () => {
                        mkController_().in(mkMatcher("bar"));

                        applyTraps_({ browserId: "foo" });

                        assert.calledOnce(ConfigurableTestObject.prototype.disable);
                    });

                    it("should disable for each mismatch", () => {
                        mkController_().in(mkMatcher("foo")).in(mkMatcher("bar"));

                        applyTraps_({ browserId: "foo" });

                        assert.calledOnce(ConfigurableTestObject.prototype.disable);
                    });

                    it("should accept few matchers", () => {
                        mkController_().in([mkMatcher("foo"), mkMatcher("bar")]);

                        applyTraps_({ browserId: "foo" });

                        assert.notCalled(ConfigurableTestObject.prototype.disable);
                    });
                });
            });

            describe(".notIn", () => {
                it("should be chainable", () => {
                    const only = mkController_();

                    const res = only.notIn(mkMatcher("foo"));

                    assert.equal(res, only);
                });

                describe("trap", () => {
                    it("should be set", () => {
                        mkController_().notIn(mkMatcher("foo"));

                        assert.calledOnceWith(TreeBuilder.prototype.addTrap, sinon.match.func);
                    });

                    it("should disable test in case of browser match", () => {
                        mkController_().notIn(mkMatcher("foo"));

                        applyTraps_({ browserId: "foo" });

                        assert.calledOnce(ConfigurableTestObject.prototype.disable);
                    });

                    it("should not disable test in case of browser mismatch", () => {
                        mkController_().notIn(mkMatcher("bar"));

                        applyTraps_({ browserId: "foo" });

                        assert.notCalled(ConfigurableTestObject.prototype.disable);
                    });

                    it("should disable for each match", () => {
                        mkController_().notIn(mkMatcher("foo")).notIn(mkMatcher("bar"));

                        applyTraps_({ browserId: "foo" });

                        assert.calledOnce(ConfigurableTestObject.prototype.disable);
                    });

                    it("should accept few matchers", () => {
                        mkController_().notIn([mkMatcher("foo"), mkMatcher("bar")]);

                        applyTraps_({ browserId: "foo" });

                        assert.calledOnce(ConfigurableTestObject.prototype.disable);
                    });
                });
            });
        });
    });
});
