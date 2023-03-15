"use strict";

const { ConfigController } = require("src/test-reader/controllers/config-controller");
const { TreeBuilder } = require("src/test-reader/tree-builder");
const ReadEvents = require("src/test-reader/read-events");
const { EventEmitter } = require("events");

describe("test-reader/controllers/config-controller", () => {
    const sandbox = sinon.sandbox.create();

    const mkController_ = () => {
        const eventBus = new EventEmitter().on(ReadEvents.NEW_BUILD_INSTRUCTION, instruction =>
            instruction({ treeBuilder: new TreeBuilder() }),
        );

        return ConfigController.create(eventBus);
    };

    beforeEach(() => {
        sandbox.stub(TreeBuilder.prototype, "addTrap");
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("testTimeout", () => {
        it("should set trap for the test object", () => {
            const controller = mkController_();

            controller.testTimeout(100500);

            assert.calledOnceWith(TreeBuilder.prototype.addTrap, sinon.match.func);
        });

        it("should be chainable", () => {
            const controller = mkController_();

            const res = controller.testTimeout(100500);

            assert.equal(res, controller);
        });

        it("should set timeout for test object", () => {
            mkController_().testTimeout(100500);

            const trap = TreeBuilder.prototype.addTrap.lastCall.args[0];
            const testObject = {};

            trap(testObject);

            assert.equal(testObject.timeout, 100500);
        });
    });
});
