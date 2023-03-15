"use strict";

const { MochaEventBus } = require("src/test-reader/mocha-reader/mocha-event-bus");
const { EventEmitter } = require("events");

describe("test-reader/mocha-event-bus", () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    describe("constructor", () => {
        it("should set infinite listeners limit for root suite", async () => {
            sandbox.spy(EventEmitter.prototype, "setMaxListeners");

            MochaEventBus.create(new EventEmitter());

            assert.calledOnceWith(EventEmitter.prototype.setMaxListeners, 0);
        });

        it("should set infinite listeners for all nested suites", async () => {
            sandbox.spy(EventEmitter.prototype, "setMaxListeners");
            const rootSuite = new EventEmitter();
            const subSuite = new EventEmitter();
            const subSubSuite = new EventEmitter();

            MochaEventBus.create(rootSuite);
            rootSuite.emit(MochaEventBus.events.EVENT_SUITE_ADD_SUITE, subSuite);
            subSuite.emit(MochaEventBus.events.EVENT_SUITE_ADD_SUITE, subSubSuite);

            assert.calledThrice(EventEmitter.prototype.setMaxListeners);
            assert.alwaysCalledWith(EventEmitter.prototype.setMaxListeners, 0);
        });
    });

    describe("file events", () => {
        ["EVENT_FILE_PRE_REQUIRE", "EVENT_FILE_POST_REQUIRE"].forEach(eventName => {
            it(`should passthrough ${eventName} event`, () => {
                const rootSuite = new EventEmitter();
                const onEvent = sinon.spy().named(`on${eventName}`);
                MochaEventBus.create(rootSuite).on(MochaEventBus.events[eventName], onEvent);

                const ctx = {};
                const file = "foo/bar.js";

                rootSuite.emit(MochaEventBus.events[eventName], ctx, file);

                assert.calledOnceWith(onEvent, ctx, file);
            });
        });
    });

    describe("test object events", () => {
        [
            "EVENT_SUITE_ADD_HOOK_BEFORE_ALL",
            "EVENT_SUITE_ADD_HOOK_AFTER_ALL",
            "EVENT_SUITE_ADD_HOOK_BEFORE_EACH",
            "EVENT_SUITE_ADD_HOOK_AFTER_EACH",
            "EVENT_SUITE_ADD_TEST",
        ].forEach(eventName => {
            it(`should passthrough ${eventName} event from all nested suites`, () => {
                const rootSuite = new EventEmitter();
                const subSuite = new EventEmitter();
                const subSubSuite = new EventEmitter();

                const onEvent = sinon.spy().named(`on${eventName}`);
                MochaEventBus.create(rootSuite).on(MochaEventBus.events[eventName], onEvent);

                rootSuite.emit(MochaEventBus.events.EVENT_SUITE_ADD_SUITE, subSuite);
                subSuite.emit(MochaEventBus.events.EVENT_SUITE_ADD_SUITE, subSubSuite);

                rootSuite.emit(MochaEventBus.events[eventName], { foo: "bar" });
                subSuite.emit(MochaEventBus.events[eventName], { bar: "baz" });
                subSubSuite.emit(MochaEventBus.events[eventName], { baz: "qux" });

                assert.calledThrice(onEvent);
                assert.calledWith(onEvent, { foo: "bar" });
                assert.calledWith(onEvent, { bar: "baz" });
                assert.calledWith(onEvent, { baz: "qux" });
            });
        });

        it("should passthrough EVENT_SUITE_ADD_SUITE event from all nested suites", () => {
            const rootSuite = new EventEmitter();
            const subSuite = new EventEmitter();
            const subSubSuite = new EventEmitter();

            const onEvent = sinon.spy().named(`onEVENT_SUITE_ADD_SUITE`);
            MochaEventBus.create(rootSuite).on(MochaEventBus.events.EVENT_SUITE_ADD_SUITE, onEvent);

            rootSuite.emit(MochaEventBus.events.EVENT_SUITE_ADD_SUITE, subSuite);
            subSuite.emit(MochaEventBus.events.EVENT_SUITE_ADD_SUITE, subSubSuite);

            assert.calledTwice(onEvent);
            assert.calledWith(onEvent, subSuite);
            assert.calledWith(onEvent, subSubSuite);
        });
    });
});
