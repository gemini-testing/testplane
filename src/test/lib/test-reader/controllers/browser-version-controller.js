"use strict";

const { mkProvider, BrowserVersionController } = require("lib/test-reader/controllers/browser-version-controller");
const { TreeBuilder } = require("lib/test-reader/tree-builder");
const ReadEvents = require("lib/test-reader/read-events");
const { EventEmitter } = require("events");

describe("test-reader/controllers/browser-version-controller", () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(TreeBuilder.prototype, "addTrap");
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("mkProvider", () => {
        it("should return controller provider function", () => {
            const provider = mkProvider();

            assert.isFunction(provider);
        });

        it("provider should fail if unknown browser id passed", () => {
            const provider = mkProvider(["foo", "bar"]);

            assert.throws(() => provider("baz"), /not found/);
        });

        it("provider should pass browser id and event bus to controller constructor", () => {
            const eventBus = new EventEmitter();
            sandbox.spy(BrowserVersionController, "create");

            mkProvider(["foo", "bar"], eventBus)("foo");

            assert.calledOnceWith(BrowserVersionController.create, "foo", eventBus);
        });

        it("provider should return created controller", () => {
            const controller = new BrowserVersionController();
            sandbox.stub(BrowserVersionController, "create").returns(controller);

            const res = mkProvider(["foo"], new EventEmitter())("foo");

            assert.equal(res, controller);
        });
    });

    describe("BrowserVersionController", () => {
        const mkController_ = ({ browserId, eventBus } = {}) => {
            eventBus = eventBus || new EventEmitter();
            browserId = browserId || "default-id";

            eventBus.on(ReadEvents.NEW_BUILD_INSTRUCTION, (instruction) => instruction({ treeBuilder: new TreeBuilder() }));

            return BrowserVersionController.create(browserId, eventBus);
        };

        describe("version", () => {
            it("should be chainable", () => {
                const controller = mkController_();

                const res = controller.version("100.500");

                assert.equal(res, controller);
            });

            describe("trap for test object", () => {
                it("should be set", () => {
                    const controller = mkController_();

                    controller.version("100.500");

                    assert.calledOnceWith(TreeBuilder.prototype.addTrap, sinon.match.func);
                });

                it("should set passed browser version for target browser", () => {
                    mkController_({ browserId: "foo" }).version("100.500");

                    const trap = TreeBuilder.prototype.addTrap.lastCall.args[0];
                    const testObject = { browserId: "foo" };

                    trap(testObject);

                    assert.propertyVal(testObject, "browserVersion", "100.500");
                });

                it("should not set passed browser version for unknown browser", () => {
                    mkController_({ browserId: "foo" }).version("100.500");

                    const trap = TreeBuilder.prototype.addTrap.lastCall.args[0];
                    const testObject = { browserId: "bar" };

                    trap(testObject);

                    assert.notProperty(testObject, "browserVersion");
                });
            });
        });
    });
});
