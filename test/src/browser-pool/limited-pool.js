"use strict";

const Promise = require("bluebird");
const { LimitedPool } = require("src/browser-pool/limited-pool");
const { CancelledError } = require("src/browser-pool/cancelled-error");
const stubBrowser = require("./util").stubBrowser;

describe("browser-pool/limited-pool", () => {
    const sandbox = sinon.createSandbox();
    let underlyingPool;

    const makePool_ = ({ limit = 1, isSpecificBrowserLimiter = true } = {}) =>
        new LimitedPool(underlyingPool, { limit, isSpecificBrowserLimiter });

    beforeEach(() => {
        underlyingPool = {
            getBrowser: sinon.stub().callsFake(id => Promise.resolve(stubBrowser(id))),
            freeBrowser: sinon.stub().returns(Promise.resolve()),
            cancel: sinon.stub(),
        };
    });

    afterEach(() => sandbox.restore());

    describe("getBrowser", () => {
        it("should request browser from underlying pool", async () => {
            const browser = stubBrowser("bro");
            underlyingPool.getBrowser.returns(Promise.resolve(browser));

            const bro = await makePool_().getBrowser("bro");

            assert.equal(bro, browser);
        });

        describe("should pass opts to underlying pool from", () => {
            it("first requested browser", async () => {
                const browser = stubBrowser("bro");
                underlyingPool.getBrowser.returns(Promise.resolve(browser));

                await makePool_().getBrowser("bro", { some: "opt" });

                assert.calledOnceWith(underlyingPool.getBrowser, "bro", { some: "opt" });
            });

            it("queued browser", async () => {
                const browser1 = stubBrowser("bro");
                const browser2 = stubBrowser("bro");
                underlyingPool.getBrowser
                    .onFirstCall()
                    .returns(Promise.resolve(browser1))
                    .onSecondCall()
                    .returns(Promise.resolve(browser2));

                const pool = await makePool_({ limit: 1 });
                await pool.getBrowser("bro", { some: "opt1" });
                // should be called without await
                Promise.delay(100).then(() => pool.freeBrowser(browser1));
                await pool.getBrowser("bro", { another: "opt2" });

                assert.calledWith(underlyingPool.getBrowser.secondCall, "bro", { another: "opt2" });
            });
        });
    });

    describe("freeBrowser", () => {
        it("should correctly pass params to an underlying pool to be able to force free", async () => {
            const pool = makePool_({ limit: 1 });
            const browser = stubBrowser("bro");

            underlyingPool.getBrowser.returns(Promise.resolve(browser));

            pool.getBrowser("bro");
            pool.getBrowser("bro", { version: "10.1" });

            await pool.freeBrowser(browser);

            assert.calledOnceWith(
                underlyingPool.freeBrowser,
                browser,
                sinon.match({
                    compositeIdForNextRequest: "bro.10.1",
                    hasFreeSlots: false,
                }),
            );
        });

        it("should handle case if there is no next item in queue", async () => {
            const pool = makePool_({ limit: 1 });
            const browser = stubBrowser("bro");

            underlyingPool.getBrowser.returns(Promise.resolve(browser));

            pool.getBrowser("bro");

            await pool.freeBrowser(browser);

            assert.calledOnceWith(
                underlyingPool.freeBrowser,
                browser,
                sinon.match({
                    compositeIdForNextRequest: undefined,
                }),
            );
        });
    });

    describe("should return browser to underlying pool", () => {
        let browser;
        let pool;

        beforeEach(() => {
            browser = stubBrowser();
            pool = makePool_();
            underlyingPool.getBrowser.returns(Promise.resolve(browser));
        });

        it("when freed", () => {
            return pool.freeBrowser(browser).then(() => assert.calledWith(underlyingPool.freeBrowser, browser));
        });

        it("for release with force if there are no more requests in specific browser limiter", () => {
            pool = makePool_({ isSpecificBrowserLimiter: true });

            return pool
                .getBrowser("first")
                .then(() => pool.freeBrowser(browser))
                .then(() => assert.calledWith(underlyingPool.freeBrowser, browser, sinon.match({ force: true })));
        });

        it("for release without force if there are no more requests in all browser limiter", () => {
            pool = makePool_({ isSpecificBrowserLimiter: false });

            return pool
                .getBrowser("first")
                .then(() => pool.freeBrowser(browser))
                .then(() => assert.calledWith(underlyingPool.freeBrowser, browser, sinon.match({ force: false })));
        });

        it("for caching if there is at least one pending request", () => {
            return pool
                .getBrowser("first")
                .then(() => {
                    pool.getBrowser("second");
                    return pool.freeBrowser(browser);
                })
                .then(() => assert.calledWith(underlyingPool.freeBrowser, browser, sinon.match({ force: false })));
        });

        it("for release if there are pending requests but forced to free", () => {
            return pool
                .getBrowser("first")
                .then(() => {
                    pool.getBrowser("second");
                    return pool.freeBrowser(browser, { force: true });
                })
                .then(() => assert.calledWith(underlyingPool.freeBrowser, browser, sinon.match({ force: true })));
        });

        it("for caching if there are pending requests", () => {
            return pool
                .getBrowser("first")
                .then(() => {
                    pool.getBrowser("second");
                    pool.getBrowser("third");
                    return pool.freeBrowser(browser);
                })
                .then(() => assert.calledWith(underlyingPool.freeBrowser, browser, sinon.match({ force: false })));
        });

        it("taking into account number of failed browser requests", () => {
            const browser = stubBrowser();
            const pool = makePool_({ limit: 2 });
            const reflect = promise => {
                return promise
                    .then(value => ({ isFulfilled: true, value }))
                    .catch(error => ({ isFulfilled: false, error }));
            };

            underlyingPool.getBrowser
                .withArgs("first")
                .returns(Promise.resolve(browser))
                .withArgs("second")
                .returns(Promise.reject());

            return Promise.all([pool.getBrowser("first"), reflect(pool.getBrowser("second"))])
                .then(() => pool.freeBrowser(browser))
                .then(() => assert.calledWith(underlyingPool.freeBrowser, browser, sinon.match({ force: true })));
        });
    });

    it("should launch next request from queue on fail to receive browser from underlying pool", () => {
        const browser = stubBrowser();
        const pool = makePool_();

        underlyingPool.getBrowser.onFirstCall().returns(Promise.reject());
        underlyingPool.getBrowser.onSecondCall().returns(Promise.resolve(browser));

        pool.getBrowser("bro").catch(() => {});

        assert.eventually.equal(pool.getBrowser("bro"), browser);
    });

    describe("limit", () => {
        it("should launch all browser in limit", () => {
            underlyingPool.getBrowser
                .withArgs("first")
                .returns(Promise.resolve(stubBrowser()))
                .withArgs("second")
                .returns(Promise.resolve(stubBrowser()));
            const pool = makePool_({ limit: 2 });

            return Promise.all([pool.getBrowser("first"), pool.getBrowser("second")]).then(() => {
                assert.calledTwice(underlyingPool.getBrowser);
                assert.calledWith(underlyingPool.getBrowser, "first");
                assert.calledWith(underlyingPool.getBrowser, "second");
            });
        });

        it("should not launch browsers out of limit", () => {
            underlyingPool.getBrowser.returns(Promise.resolve(stubBrowser()));
            const withTimeout = async (promise, ms, timeoutMessage) => {
                let timeout;
                const timeoutPromise = new Promise((_, reject) => {
                    timeout = setTimeout(() => reject(new Error(timeoutMessage)), ms);
                });

                return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
            };
            const pool = makePool_({ limit: 1 });

            const result = pool.getBrowser("first").then(() => withTimeout(pool.getBrowser("second"), 100, "timeout"));

            return assert.isRejected(result, /timeout$/);
        });

        it("should launch next browser after previous is released", () => {
            const expectedBrowser = stubBrowser();
            const pool = makePool_({ limit: 1 });

            underlyingPool.getBrowser
                .withArgs("first")
                .returns(Promise.resolve(stubBrowser()))
                .withArgs("second")
                .returns(Promise.resolve(expectedBrowser));

            const result = pool
                .getBrowser("first")
                .then(browser => pool.freeBrowser(browser))
                .then(() => pool.getBrowser("second"));

            return assert.eventually.equal(result, expectedBrowser);
        });

        it("should launch queued browser when previous is released", () => {
            const expectedBrowser = stubBrowser();
            const pool = makePool_({ limit: 1 });

            underlyingPool.getBrowser
                .withArgs("first")
                .returns(Promise.resolve(stubBrowser()))
                .withArgs("second")
                .returns(Promise.resolve(expectedBrowser));

            const result = pool.getBrowser("first").then(browser => {
                const secondPromise = pool.getBrowser("second");
                return Promise.delay(100)
                    .then(() => pool.freeBrowser(browser))
                    .then(() => secondPromise);
            });

            return assert.eventually.equal(result, expectedBrowser);
        });

        it("should perform high priority request first", async () => {
            const firstBrowserRequest = underlyingPool.getBrowser.withArgs("first").named("firstRequest");
            const secondBrowserRequest = underlyingPool.getBrowser.withArgs("second").named("secondRequest");
            const thirdBrowserRequest = underlyingPool.getBrowser.withArgs("third").named("thirdRequest");

            const pool = makePool_({ limit: 1 });
            const free_ = bro => pool.freeBrowser(bro);

            await Promise.all([
                pool.getBrowser("first").then(free_),
                pool.getBrowser("second").then(free_),
                pool.getBrowser("third", { highPriority: true }).then(free_),
            ]);

            assert.callOrder(firstBrowserRequest, thirdBrowserRequest, secondBrowserRequest);
        });

        it("should launch next browsers if free failed", () => {
            const expectedBrowser = stubBrowser();
            const pool = makePool_({ limit: 1 });

            underlyingPool.getBrowser
                .withArgs("first")
                .returns(Promise.resolve(stubBrowser()))
                .withArgs("second")
                .returns(Promise.resolve(expectedBrowser));

            underlyingPool.freeBrowser.callsFake(() => Promise.reject());

            return pool
                .getBrowser("first")
                .then(browser => {
                    const secondPromise = pool.getBrowser("second");
                    return Promise.delay(100)
                        .then(() => pool.freeBrowser(browser))
                        .catch(() => secondPromise);
                })
                .then(browser => assert.equal(browser, expectedBrowser));
        });

        it("should not wait for queued browser to start after release browser", () => {
            const pool = makePool_({ limit: 1 });
            const afterFree = sinon.spy().named("afterFree");
            const afterSecondGet = sinon.spy().named("afterSecondGet");

            underlyingPool.getBrowser
                .withArgs("first")
                .returns(Promise.resolve(stubBrowser()))
                .withArgs("second")
                .returns(Promise.resolve());

            return pool.getBrowser("first").then(browser => {
                const freeFirstBrowser = Promise.delay(100)
                    .then(() => pool.freeBrowser(browser))
                    .then(afterFree);

                const getSecondBrowser = pool.getBrowser("second").then(afterSecondGet);

                return Promise.all([getSecondBrowser, freeFirstBrowser]).then(() =>
                    assert.callOrder(afterFree, afterSecondGet),
                );
            });
        });

        it("should reject the queued call when underlying pool rejects the request", () => {
            const pool = makePool_({ limit: 1 });
            const error = new Error("You shall not pass");
            underlyingPool.getBrowser.onSecondCall().callsFake(() => Promise.reject(error));

            return pool.getBrowser("bro").then(browser => {
                const secondRequest = pool.getBrowser("bro");
                return pool.freeBrowser(browser).then(() => assert.isRejected(secondRequest, error));
            });
        });
    });

    describe("cancel", () => {
        it("should cancel queued browsers", async () => {
            const pool = makePool_({ limit: 1 });

            const firstRequest = pool.getBrowser("bro").then(bro => {
                pool.cancel();
                return pool.freeBrowser(bro);
            });
            const secondRequest = pool.getBrowser("bro");
            const thirdRequest = pool.getBrowser("bro", { highPriority: true });

            await Promise.all([firstRequest, secondRequest, thirdRequest]).catch(() => {});

            await assert.isRejected(secondRequest, CancelledError);
            await assert.isRejected(thirdRequest, CancelledError);
        });

        it("should cancel an underlying pool", () => {
            const pool = makePool_({ limit: 1 });

            pool.cancel();

            assert.calledOnce(underlyingPool.cancel);
        });

        it("should reset request queue", async () => {
            const pool = makePool_({ limit: 1 });
            const free_ = bro => pool.freeBrowser(bro);

            await Promise.all([
                pool.getBrowser("first").then(bro => {
                    pool.cancel();
                    return free_(bro);
                }),
                pool.getBrowser("second").then(free_),
                pool.getBrowser("third", { highPriority: true }).then(free_),
            ]).catch(() => {});

            assert.calledOnce(underlyingPool.getBrowser);
            assert.neverCalledWith(underlyingPool.getBrowser, "second");
            assert.neverCalledWith(underlyingPool.getBrowser, "third");
        });
    });
});
