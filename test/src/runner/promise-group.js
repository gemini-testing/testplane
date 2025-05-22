"use strict";

const PromiseGroup = require("src/runner/promise-group");
const { promiseDelay } = require("../../../src/utils/promise");

describe("runner/promise-group", () => {
    const sandbox = sinon.createSandbox();

    describe("add", () => {
        it("resolves promise if group is not fulfilled", async () => {
            const group = new PromiseGroup();
            const promise1 = { then: sandbox.stub().returnsThis(), catch: sandbox.stub() };
            const promise2 = { then: sandbox.stub().returnsThis(), catch: sandbox.stub() };

            group.add(promise1);
            group.add(promise2);

            assert.callOrder(promise1.then, promise2.then);
        });

        it("throws an error if group is fulfilled", async () => {
            const group = new PromiseGroup();

            group.add(new Promise(r => r()));
            await group.done();

            assert.throws(() => group.add(new Promise(r => r())));
        });
    });

    describe("isFulfilled", () => {
        it("returns false if no promises were added to the group", async () => {
            const group = new PromiseGroup();
            await group.done();

            assert.isFalse(group.isFulfilled());
        });

        it("returns false if not all added promises are fulfilled", async () => {
            const group = new PromiseGroup();
            group.add(new Promise(r => r()));

            assert.isFalse(group.isFulfilled());
        });

        it("returns true if all added promises are fulfilled", async () => {
            const group = new PromiseGroup();
            group.add(new Promise(r => r()));
            await group.done();

            assert.isTrue(group.isFulfilled());
        });
    });

    describe("done", () => {
        it("returns promise which will be resolved after all added promises", async () => {
            const group = new PromiseGroup();
            const afterFirst = sandbox.stub().named("afterFirst");
            const afterSecond = sandbox.stub().named("afterSecond");
            const afterAll = sandbox.stub().named("afterAll");

            group.add(promiseDelay(1)).then(afterFirst);
            group.add(promiseDelay(10)).then(afterSecond);

            await group.done();

            await promiseDelay(1).then(afterAll).then(promiseDelay(1));

            assert.callOrder(afterFirst, afterSecond, afterAll);
        });
    });
});
