"use strict";

const { SkipController } = require("src/test-reader/controllers/skip-controller");
const { TreeBuilder } = require("src/test-reader/tree-builder");
const { ConfigurableTestObject } = require("src/test-reader/test-object/configurable-test-object");
const ReadEvents = require("src/test-reader/read-events");
const { EventEmitter } = require("events");

describe("test-reader/controllers/skip-controller", () => {
    const sandbox = sinon.sandbox.create();

    const mkController_ = () => {
        const eventBus = new EventEmitter().on(ReadEvents.NEW_BUILD_INSTRUCTION, instruction =>
            instruction({ treeBuilder: new TreeBuilder() }),
        );

        return SkipController.create(eventBus);
    };

    const mkTestObject_ = ({ browserId } = {}) => {
        const testObject = ConfigurableTestObject.create({});
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

        sandbox.stub(ConfigurableTestObject.prototype, "skip");
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
                    const skip = mkController_();

                    const res = skip.in(mkMatcher("foo"));

                    assert.equal(res, skip);
                });

                describe("trap", () => {
                    it("should be set", () => {
                        mkController_().in(mkMatcher("foo"));

                        assert.calledOnceWith(TreeBuilder.prototype.addTrap, sinon.match.func);
                    });

                    it("should skip test object in case of browser match", () => {
                        mkController_().in(mkMatcher("foo"));

                        applyTraps_({ browserId: "foo" });

                        assert.calledOnce(ConfigurableTestObject.prototype.skip);
                    });

                    it("should not skip test object in case of browser mismatch", () => {
                        mkController_().in(mkMatcher("foo"));

                        applyTraps_({ browserId: "bar" });

                        assert.notCalled(ConfigurableTestObject.prototype.skip);
                    });

                    it("should skip with reason", () => {
                        mkController_().in(mkMatcher("foo"), "some reason");

                        applyTraps_({ browserId: "foo" });

                        assert.calledOnceWith(ConfigurableTestObject.prototype.skip, { reason: "some reason" });
                    });

                    it("should skip for each match", () => {
                        mkController_().in(mkMatcher("foo"), "some reason").in(mkMatcher("foo"), "other reason");

                        applyTraps_({ browserId: "foo" });

                        assert.calledTwice(ConfigurableTestObject.prototype.skip);
                        assert.calledWith(ConfigurableTestObject.prototype.skip, { reason: "some reason" });
                        assert.calledWith(ConfigurableTestObject.prototype.skip, { reason: "other reason" });
                    });

                    it("should accept few matchers", () => {
                        mkController_().in([mkMatcher("foo"), mkMatcher("bar")]);

                        applyTraps_({ browserId: "foo" });

                        assert.calledOnce(ConfigurableTestObject.prototype.skip);
                    });

                    it("should disable test object if silent option passed", () => {
                        mkController_().in(mkMatcher("foo"), "some reason", { silent: true });

                        applyTraps_({ browserId: "foo" });

                        assert.calledOnce(ConfigurableTestObject.prototype.disable);
                        assert.notCalled(ConfigurableTestObject.prototype.skip);
                    });
                });
            });

            describe(".notIn", () => {
                it("should be chainable", () => {
                    const skip = mkController_();

                    const res = skip.notIn(mkMatcher("foo"));

                    assert.equal(res, skip);
                });

                describe("trap", () => {
                    it("should be set", () => {
                        mkController_().notIn("foo");

                        assert.calledOnceWith(TreeBuilder.prototype.addTrap, sinon.match.func);
                    });

                    it("should skip test object in case of browser mismatch", () => {
                        mkController_().notIn(mkMatcher("bar"));

                        applyTraps_({ browserId: "foo" });

                        assert.calledOnce(ConfigurableTestObject.prototype.skip);
                    });

                    it("should skip with reason", () => {
                        mkController_().notIn(mkMatcher("bar"), "some reason");

                        applyTraps_({ browserId: "foo" });

                        assert.calledWith(ConfigurableTestObject.prototype.skip, { reason: "some reason" });
                    });

                    it("should not skip test object in case of browser match", () => {
                        mkController_({ browser: "foo" }).notIn(mkMatcher("foo"));

                        applyTraps_({ browserId: "foo" });

                        assert.notCalled(ConfigurableTestObject.prototype.skip);
                    });

                    it("should skip for each match", () => {
                        mkController_().notIn(mkMatcher("bar"), "some reason").notIn(mkMatcher("bar"), "other reason");

                        applyTraps_({ browserId: "foo" });

                        assert.calledTwice(ConfigurableTestObject.prototype.skip);
                        assert.calledWith(ConfigurableTestObject.prototype.skip, { reason: "some reason" });
                        assert.calledWith(ConfigurableTestObject.prototype.skip, { reason: "other reason" });
                    });

                    it("should accept few matchers", () => {
                        mkController_().notIn([mkMatcher("foo"), mkMatcher("bar")]);

                        applyTraps_({ browserId: "foo" });

                        assert.notCalled(ConfigurableTestObject.prototype.skip);
                    });

                    it("should disable test object if silent option passed", () => {
                        mkController_().notIn(mkMatcher("bar"), "some reason", { silent: true });

                        applyTraps_({ browserId: "foo" });

                        assert.calledOnce(ConfigurableTestObject.prototype.disable);
                        assert.notCalled(ConfigurableTestObject.prototype.skip);
                    });
                });
            });
        });
    });
});
