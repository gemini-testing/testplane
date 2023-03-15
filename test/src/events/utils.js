"use strict";

const Promise = require("bluebird");

const AsyncEmitter = require("src/events/async-emitter");
const utils = require("src/events/utils");

describe("events/utils", () => {
    describe("passthroughEvent", () => {
        it("should passthrough event synchronously", () => {
            const from = new AsyncEmitter();
            const to = new AsyncEmitter();
            const spy = sinon.spy();

            utils.passthroughEvent(from, to, "some-event");

            to.on("some-event", spy);
            from.emit("some-event", "val1", "val2");

            assert.calledWith(spy, "val1", "val2");
        });

        it("should passthrough all passed events", () => {
            const from = new AsyncEmitter();
            const to = new AsyncEmitter();
            const someSpy = sinon.spy().named("someSpy");
            const otherSpy = sinon.spy().named("otherSpy");

            utils.passthroughEvent(from, to, ["some-event", "other-event"]);
            to.on("some-event", someSpy);
            to.on("other-event", otherSpy);

            from.emit("some-event", "v1", "v2");
            from.emit("other-event", "d1", "d2");

            assert.calledWith(someSpy, "v1", "v2");
            assert.calledWith(otherSpy, "d1", "d2");
        });
    });

    describe("passthroughEventAsync", () => {
        it("should passthrough event", () => {
            const from = new AsyncEmitter();
            const to = new AsyncEmitter();
            const spy = sinon.spy();

            utils.passthroughEventAsync(from, to, "some-event");

            to.on("some-event", spy);
            from.emit("some-event", "val1", "val2");

            assert.calledOnceWith(spy, "val1", "val2");
        });

        it("should passthrough all passed events", () => {
            const from = new AsyncEmitter();
            const to = new AsyncEmitter();
            const someSpy = sinon.spy().named("someSpy");
            const otherSpy = sinon.spy().named("otherSpy");

            utils.passthroughEventAsync(from, to, ["some-event", "other-event"]);

            to.on("some-event", someSpy);
            to.on("other-event", otherSpy);

            from.emit("some-event", "v1", "v2");
            from.emit("other-event", "d1", "d2");

            assert.calledWith(someSpy, "v1", "v2");
            assert.calledWith(otherSpy, "d1", "d2");
        });

        it("should wait until the promise from `to` handler is resolved", () => {
            const from = new AsyncEmitter();
            const to = new AsyncEmitter();
            const afterWait = sinon.spy().named("afterWait");
            const insideHandler = sinon.spy().named("insideHandler");

            utils.passthroughEventAsync(from, to, "some-event");

            to.on("some-event", () => Promise.delay(1).then(insideHandler));

            return from
                .emitAndWait("some-event")
                .then(afterWait)
                .then(() => assert.callOrder(insideHandler, afterWait));
        });
    });
});
