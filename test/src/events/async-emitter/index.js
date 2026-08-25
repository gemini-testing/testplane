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

    describe("with observer", () => {
        let observer;

        beforeEach(() => {
            observer = {
                register: sandbox.stub().callsFake(registration => registration),
                observeSync: sandbox.spy((_registration, action) => action()),
                observeAsync: sandbox.spy(async (_registration, action) => action()),
                observeSyncEmission: sandbox.spy((_event, action) => action()),
                observeAsyncEmission: sandbox.spy(async (_event, action) => action()),
                error: sandbox.spy(),
            };
            emitter.setEventObserver(observer);
        });

        it("should preserve listener context, arguments, return and thrown error for sync emit", () => {
            const expectedError = new Error("boom");
            const listener = sandbox.spy(function (value) {
                assert.equal(this, emitter);
                assert.equal(value, "argument");
                throw expectedError;
            });

            emitter.on("event", listener);

            let actualError;
            try {
                emitter.emit("event", "argument");
            } catch (error) {
                actualError = error;
            }
            assert.strictEqual(actualError, expectedError);
            assert.calledOnce(listener);
            assert.calledOnce(observer.observeSync);
            assert.calledOnce(observer.observeSyncEmission);
        });

        it("should measure the full async listener without measuring it as sync", async () => {
            const listener = sandbox.stub().callsFake(() => promiseDelay(5).then(() => "result"));
            emitter.on("event", listener);

            assert.deepEqual(await emitter.emitAndWait("event"), ["result"]);
            assert.calledOnce(observer.observeAsync);
            assert.notCalled(observer.observeSync);
            assert.calledOnce(observer.observeAsyncEmission);
        });

        it("should preserve duplicate registration and remove the latest original listener", () => {
            const listener = sandbox.spy();
            emitter.on("event", listener);
            emitter.on("event", listener);

            emitter.removeListener("event", listener);
            emitter.emit("event");

            assert.calledOnce(listener);
            assert.lengthOf(emitter.listeners("event"), 1);
            assert.strictEqual(emitter.listeners("event")[0], listener);
        });

        it("should preserve once and prepend order for sync and async dispatch", async () => {
            const calls = [];
            emitter.on("sync", () => calls.push("normal"));
            emitter.prependOnceListener("sync", () => calls.push("once"));
            emitter.emit("sync");
            emitter.emit("sync");

            emitter.once("async", () => calls.push("async-once"));
            await emitter.emitAndWait("async");
            await emitter.emitAndWait("async");

            assert.deepEqual(calls, ["once", "normal", "normal", "async-once"]);
        });

        it("should expose original listeners and Node-compatible raw once listener", () => {
            const regular = () => undefined;
            const once = () => undefined;
            emitter.on("event", regular);
            emitter.once("event", once);

            const listeners = emitter.listeners("event");
            const rawListeners = emitter.rawListeners("event");

            assert.deepEqual(listeners, [regular, once]);
            assert.strictEqual(rawListeners[0], regular);
            assert.notStrictEqual(rawListeners[1], once);
            assert.strictEqual(rawListeners[1].listener, once);
        });

        it("should expose original listener through newListener and removeListener events", () => {
            const added = sandbox.spy();
            const removed = sandbox.spy();
            const listener = () => undefined;
            emitter.on("newListener", (event, value) => event === "target" && added(value));
            emitter.on("removeListener", (event, value) => event === "target" && removed(value));

            emitter.on("target", listener);
            emitter.off("target", listener);

            assert.calledOnceWith(added, listener);
            assert.calledOnceWith(removed, listener);
        });

        it("should preserve listener mutation semantics", () => {
            const calls = [];
            const second = () => calls.push("second");
            emitter.on("event", () => {
                calls.push("first");
                emitter.removeListener("event", second);
            });
            emitter.on("event", second);

            emitter.emit("event");
            emitter.emit("event");

            assert.deepEqual(calls, ["first", "second", "first"]);
        });

        it("should invoke a sync listener once when the observer fails after the action", () => {
            const listener = sandbox.stub().returns("listener-result");
            observer.observeSyncEmission = sandbox.stub().callsFake((_event, action) => {
                action();
                throw new Error("observer failed");
            });
            emitter.on("event", listener);

            assert.isTrue(emitter.emit("event"));
            assert.calledOnce(listener);
            assert.calledOnce(observer.error);
        });

        it("should never invoke a listener twice when the observer repeats the action", async () => {
            const syncListener = sandbox.stub().returns("sync-result");
            const asyncListener = sandbox.stub().resolves("async-result");
            observer.observeSync = sandbox.stub().callsFake((_registration, action) => [action(), action()][0]);
            observer.observeAsync = sandbox
                .stub()
                .callsFake(async (_registration, action) =>
                    Promise.all([action(), action()]).then(([result]) => result),
                );
            emitter.on("sync", syncListener);
            emitter.on("async", asyncListener);

            assert.isTrue(emitter.emit("sync"));
            assert.deepEqual(await emitter.emitAndWait("async"), ["async-result"]);
            assert.calledOnce(syncListener);
            assert.calledOnce(asyncListener);
        });

        it("should preserve a sync listener error even when the observer swallows it", () => {
            const expectedError = new Error("listener failed");
            observer.observeSync = sandbox.stub().callsFake((_registration, action) => {
                try {
                    action();
                } catch {
                    // Deliberately swallow the listener error to test emitter recovery.
                }
            });
            emitter.on("event", () => {
                throw expectedError;
            });

            assert.throws(() => emitter.emit("event"), expectedError);
        });

        it("should invoke an async listener once when the observer rejects after the action", async () => {
            const listener = sandbox.stub().resolves("listener-result");
            observer.observeAsync = sandbox.stub().callsFake(async (_registration, action) => {
                await action();
                throw new Error("observer failed");
            });
            emitter.on("event", listener);

            assert.deepEqual(await emitter.emitAndWait("event"), ["listener-result"]);
            assert.calledOnce(listener);
            assert.calledOnce(observer.error);
        });

        it("should preserve an async listener error even when the observer swallows it", async () => {
            const expectedError = new Error("listener failed");
            observer.observeAsync = sandbox.stub().callsFake(async (_registration, action) => {
                try {
                    await action();
                } catch {
                    // Deliberately swallow the listener error to test emitter recovery.
                }
            });
            emitter.on("event", () => Promise.reject(expectedError));

            await assert.isRejected(emitter.emitAndWait("event"), expectedError);
        });
    });
});
