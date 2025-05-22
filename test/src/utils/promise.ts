import sinon from "sinon";
import { promiseMethod, promiseTimeout, promiseDelay, promiseMapSeries } from "../../../src/utils/promise";

describe("utils/promise", () => {
    const sandbox = sinon.createSandbox();
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
        sandbox.restore();
    });

    describe("promiseMethod", () => {
        it("should convert a synchronous function to return a promise", async () => {
            const syncFn = (): string => "result";
            const promiseFn = promiseMethod(syncFn);

            const result = promiseFn();

            assert.instanceOf(result, Promise);
            assert.equal(await result, "result");
        });

        it("should preserve 'this' context", async () => {
            const context = { value: "test" };
            const syncFn = function (this: typeof context): string {
                return this.value;
            };

            const promiseFn = promiseMethod(syncFn);

            const result = await promiseFn.call(context);

            assert.equal(result, "test");
        });

        it("should handle function arguments", async () => {
            const syncFn = (a: number, b: number): number => a + b;
            const promiseFn = promiseMethod(syncFn);

            const result = await promiseFn(2, 3);

            assert.equal(result, 5);
        });

        it("should convert thrown errors to rejected promises", async () => {
            const error = new Error("test error");
            const syncFn = (): never => {
                throw error;
            };

            const promiseFn = promiseMethod(syncFn);

            await assert.isRejected(promiseFn(), "test error");
        });
    });

    describe("promiseTimeout", () => {
        it("should resolve with the original promise result if it completes before timeout", async () => {
            const promise = Promise.resolve("success");

            const result = await promiseTimeout(promise, 100, "timeout error");

            assert.equal(result, "success");
        });

        it("should reject with timeout error if the promise takes too long", async () => {
            const promise = new Promise<string>(resolve => setTimeout(() => resolve("success"), 200));

            const timeoutPromise = promiseTimeout(promise, 100, "timeout error");

            clock.tick(101);

            await assert.isRejected(timeoutPromise, "timeout error");
        });

        it("should clear the timeout when the promise resolves", async () => {
            const clearTimeoutSpy = sandbox.spy(global, "clearTimeout");
            const promise = Promise.resolve("success");

            await promiseTimeout(promise, 100, "timeout error");

            assert.calledOnce(clearTimeoutSpy);
        });

        it("should clear the timeout when the promise rejects", async () => {
            const clearTimeoutSpy = sandbox.spy(global, "clearTimeout");
            const promise = Promise.reject(new Error("original error"));

            await promiseTimeout(promise, 100, "timeout error").catch(() => {});

            assert.calledOnce(clearTimeoutSpy);
        });
    });

    describe("promiseDelay", () => {
        it("should resolve after the specified delay", async () => {
            const promise = promiseDelay(100);
            const callback = sandbox.spy();

            promise.then(callback);

            assert.notCalled(callback);

            clock.tick(99);
            await Promise.resolve();

            assert.notCalled(callback);

            clock.tick(1);
            await Promise.resolve();

            assert.calledOnce(callback);
        });

        it("should work with await syntax", async () => {
            const beforeTime = Date.now();
            clock.tick(1000);

            const delayPromise = promiseDelay(500);
            clock.tick(500);
            await delayPromise;

            const afterTime = Date.now();
            assert.equal(afterTime - beforeTime, 500);
        });
    });

    describe("promiseMapSeries", () => {
        it("should process items in sequence", async () => {
            const items = [1, 2, 3];
            const order: number[] = [];

            const mapper = async (item: number): Promise<number> => {
                order.push(item);
                return item * 2;
            };

            const results = await promiseMapSeries(items, mapper);

            assert.deepEqual(results, [2, 4, 6]);
            assert.deepEqual(order, [1, 2, 3]);
        });

        it("should wait for each promise to resolve before processing the next item", async () => {
            const items = [100, 50, 25];
            const order: number[] = [];

            const mapper = async (item: number): Promise<number> => {
                const promise = promiseDelay(item).then(() => {
                    order.push(item);
                    return item * 2;
                });

                clock.tick(item);
                return promise;
            };

            const resultsPromise = promiseMapSeries(items, mapper);
            await Promise.resolve();

            const results = await resultsPromise;

            assert.deepEqual(results, [200, 100, 50]);
            assert.deepEqual(order, [100, 50, 25]);
        });

        it("should handle empty arrays", async () => {
            const items: number[] = [];
            const mapper = async (item: number): Promise<number> => item * 2;

            const results = await promiseMapSeries(items, mapper);

            assert.deepEqual(results, []);
        });

        it("should handle synchronous mappers", async () => {
            const items = [1, 2, 3];
            const mapper = (item: number): number => item * 2;

            const results = await promiseMapSeries(items, mapper);

            assert.deepEqual(results, [2, 4, 6]);
        });

        it("should stop processing on error and reject with that error", async () => {
            const items = [1, 2, 3];
            const error = new Error("test error");
            const order: number[] = [];

            const mapper = async (item: number): Promise<number> => {
                order.push(item);
                if (item === 2) {
                    throw error;
                }
                return item * 2;
            };

            await assert.isRejected(promiseMapSeries(items, mapper), "test error");
            assert.deepEqual(order, [1, 2]);
        });
    });
});
