"use strict";

const { AsyncEmitter } = require("src/events/async-emitter");
const { promiseDelay } = require("../../../../src/utils/promise");

describe("events/async-emitter", () => {
    const sandbox = sinon.createSandbox();
    let emitter;

    beforeEach(() => {
        emitter = new AsyncEmitter();
    });

    afterEach(() => sandbox.restore());

    it("should wait until all promises from handler will be resolved", () => {
        const insideHandler1 = sinon.spy();
        const insideHandler2 = sinon.spy();
        const afterWait = sinon.spy();

        emitter.on("event", () => promiseDelay(1).then(insideHandler1));
        emitter.on("event", () => promiseDelay(2).then(insideHandler2));

        return emitter
            .emitAndWait("event")
            .then(afterWait)
            .then(() => assert.callOrder(insideHandler1, insideHandler2, afterWait));
    });

    it("should wait for all promises if some of them was rejected", () => {
        const rejectSyncHandler = sandbox.stub().throws(new Error("some-error"));
        const rejectHandler = sandbox.stub().rejects(new Error("other-error"));
        const resolveHandler = sandbox.stub().resolves();

        emitter.on("event", () => rejectSyncHandler());
        emitter.on("event", () => rejectHandler());
        emitter.on("event", () => promiseDelay(10).then(resolveHandler));

        return emitter
            .emitAndWait("event")
            .catch(() => assert.callOrder(rejectSyncHandler, rejectHandler, resolveHandler));
    });

    it("should return result of resolved promises", () => {
        emitter.on("event", () => ({ some: "value" }));

        return emitter.emitAndWait("event").then(res => assert.deepEqual(res, [{ some: "value" }]));
    });

    it("should pass the arguments except first to the listener", () => {
        const listener = sinon.spy();

        emitter.on("event", listener);

        return emitter.emitAndWait("event", "arg1", "arg2").then(() => assert.calledOnceWith(listener, "arg1", "arg2"));
    });
});
