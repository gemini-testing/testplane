'use strict';

const Promise = require('bluebird');
const Pool = require('lib/browser-pool/caching-pool');
const {buildCompositeBrowserId} = require('lib/browser-pool/utils');
const stubBrowser = require('./util').stubBrowser;

describe('browser-pool/caching-pool', () => {
    const sandbox = sinon.sandbox.create();

    let underlyingPool;

    const poolWithReuseLimits_ = (limits) => {
        const config = {
            getBrowserIds: sinon.stub().returns(Object.keys(limits)),
            forBrowser: (id) => {
                return {
                    testsPerSession: limits[id]
                };
            }
        };

        return new Pool(underlyingPool, config, {});
    };

    const makePool_ = () => poolWithReuseLimits_({bro: Infinity});

    beforeEach(() => {
        underlyingPool = {
            getBrowser: sinon.stub().callsFake((id, opts) => Promise.resolve(stubBrowser(id, opts.version))),
            freeBrowser: sinon.stub().returns(Promise.resolve()),
            finalizeBrowsers: sinon.stub().returns(Promise.resolve()),
            cancel: sinon.stub()
        };
    });

    afterEach(() => sandbox.restore());

    describe('based on browser id only', () => {
        createCommonTestCases();
    });

    describe('based on both browser id and version', () => {
        createCommonTestCases({version: 1.0});
    });

    function createCommonTestCases(opts = {}) {
        it('should create new browser when requested first time', () => {
            const pool = makePool_();

            return pool.getBrowser('bro', opts)
                .then(() => {
                    assert.calledOnceWith(underlyingPool.getBrowser, 'bro', opts);
                });
        });

        it('should return same browser as returned by underlying pool', () => {
            const browser = stubBrowser('bro');
            underlyingPool.getBrowser.withArgs('bro', opts).returns(Promise.resolve(browser));

            return makePool_()
                .getBrowser('bro', opts)
                .then((bro) => assert.equal(bro, browser));
        });

        it('should not reset new browser', () => {
            const browser = stubBrowser();
            underlyingPool.getBrowser.withArgs('bro', opts).returns(Promise.resolve(browser));

            return makePool_()
                .getBrowser('bro', opts)
                .then(() => assert.notCalled(browser.reset));
        });

        it('should create and launch new browser if there is free browser with different id', () => {
            underlyingPool.getBrowser
                .withArgs('first').returns(Promise.resolve(stubBrowser('first', opts.version)))
                .withArgs('second').returns(Promise.resolve(stubBrowser('second', opts.version)));

            const pool = poolWithReuseLimits_({
                first: 1,
                second: 1
            });

            return pool.getBrowser('first', opts)
                .then((browser) => pool.freeBrowser(browser))
                .then(() => pool.getBrowser('second', opts))
                .then(() => assert.calledWith(underlyingPool.getBrowser, 'second', opts));
        });

        it('should not quit browser when freed', () => {
            underlyingPool.getBrowser.withArgs('bro', opts)
                .returns(Promise.resolve(stubBrowser('bro', opts.version)));
            const pool = makePool_();

            return pool.getBrowser('bro', opts)
                .then((browser) => pool.freeBrowser(browser, {force: false}))
                .then(() => assert.notCalled(underlyingPool.freeBrowser));
        });

        it('should quit browser when there are no more requests', () => {
            underlyingPool.getBrowser.withArgs('bro', opts)
                .returns(Promise.resolve(stubBrowser('bro', opts.version)));
            const pool = makePool_();

            return pool.getBrowser('bro', opts)
                .then((browser) => pool.freeBrowser(browser, {force: true}))
                .then(() => assert.calledOnce(underlyingPool.freeBrowser));
        });

        describe('when there is free browser with the same id', () => {
            let browser, pool;

            beforeEach(() => {
                browser = stubBrowser('bro', opts.version);
                pool = makePool_();

                pool.getBrowser('bro', opts);
                underlyingPool.getBrowser.reset();

                return pool.freeBrowser(browser);
            });

            it('should not create second instance', () => {
                return pool.getBrowser('bro', opts)
                    .then(() => assert.notCalled(underlyingPool.getBrowser));
            });

            it('should reset the browser', () => {
                return pool.getBrowser('bro', opts)
                    .then(() => assert.calledOnce(browser.reset));
            });

            describe('when reset failed', () => {
                it('should fail to get browser', () => {
                    browser.reset.returns(Promise.reject('some-error'));
                    return assert.isRejected(pool.getBrowser('bro', opts), /some-error/);
                });

                it('should put browser back', () => {
                    browser.reset.returns(Promise.reject());

                    return pool.getBrowser('bro', opts)
                        .catch(() => {
                            assert.calledOnce(underlyingPool.freeBrowser);
                            assert.calledWith(underlyingPool.freeBrowser, browser);
                        });
                });

                it('should keep original error if failed to put browser back', () => {
                    browser.reset.returns(Promise.reject('reset-error'));
                    underlyingPool.freeBrowser.rejects(new Error('free-error'));

                    return assert.isRejected(pool.getBrowser('bro', opts), /reset-error/);
                });
            });
        });

        describe('when there are multiple browsers with same id', () => {
            let firstBrowser, secondBrowser, pool;

            beforeEach(() => {
                firstBrowser = stubBrowser('bro', opts.version);
                secondBrowser = stubBrowser('bro', opts.version);
                pool = makePool_();

                pool.getBrowser('bro', opts);

                return Promise.all([
                    pool.freeBrowser(firstBrowser),
                    pool.freeBrowser(secondBrowser)
                ]);
            });

            it('should return last browser in cache on first getBrowser', () => {
                return assert.becomes(pool.getBrowser('bro', opts), secondBrowser);
            });

            it('should return first browser on second getBrowser', () => {
                return pool.getBrowser('bro', opts)
                    .then(() => assert.becomes(pool.getBrowser('bro', opts), firstBrowser));
            });

            it('should launch new session when there are no free browsers left', () => {
                return pool.getBrowser('bro', opts)
                    .then(() => pool.getBrowser('bro', opts))
                    .then(() => pool.getBrowser('bro', opts))
                    .then(() => assert.calledWith(underlyingPool.getBrowser, 'bro', opts));
            });
        });

        describe('when there is reuse limit', () => {
            const launchAndFree_ = (pool, id) => {
                return pool.getBrowser(id, opts)
                    .then((browser) => pool.freeBrowser(browser));
            };

            it('should launch only one session within the reuse limit', () => {
                underlyingPool.getBrowser.returns(Promise.resolve(stubBrowser('bro', opts.version)));
                const pool = poolWithReuseLimits_({bro: 2});
                return launchAndFree_(pool, 'bro')
                    .then(() => pool.getBrowser('bro', opts))
                    .then(() => assert.calledOnce(underlyingPool.getBrowser));
            });

            it('should launch next session when over reuse limit', () => {
                underlyingPool.getBrowser
                    .onFirstCall().returns(Promise.resolve(stubBrowser('bro', opts.version)))
                    .onSecondCall().returns(Promise.resolve(stubBrowser('bro', opts.version)));
                const pool = poolWithReuseLimits_({bro: 2});
                return launchAndFree_(pool, 'bro')
                    .then(() => launchAndFree_(pool, 'bro'))
                    .then(() => pool.getBrowser('bro', opts))
                    .then(() => assert.calledTwice(underlyingPool.getBrowser));
            });

            it('should get new session for each suite if reuse limit equal 1', () => {
                underlyingPool.getBrowser
                    .onFirstCall().returns(Promise.resolve(stubBrowser('browserId', opts.version)))
                    .onSecondCall().returns(Promise.resolve(stubBrowser('browserId', opts.version)));
                const pool = poolWithReuseLimits_({browserId: 1});
                return launchAndFree_(pool, 'browserId')
                    .then(() => pool.getBrowser('browserId', opts))
                    .then(() => assert.calledTwice(underlyingPool.getBrowser));
            });

            it('should close old session when reached reuse limit', () => {
                const browser = stubBrowser('bro', opts.version);
                underlyingPool.getBrowser.returns(Promise.resolve(browser));
                const pool = poolWithReuseLimits_({bro: 2});
                return launchAndFree_(pool, 'bro')
                    .then(() => launchAndFree_(pool, 'bro'))
                    .then(() => assert.calledWith(underlyingPool.freeBrowser, browser));
            });

            it('should cache browser with different id even if the first one is over limit', () => {
                underlyingPool.getBrowser
                    .withArgs('first').returns(Promise.resolve(stubBrowser('first', opts.version)));

                const createSecondBrowser = underlyingPool.getBrowser.withArgs('second', opts);
                createSecondBrowser.returns(Promise.resolve(stubBrowser('second', opts.version)));

                const pool = poolWithReuseLimits_({
                    first: 2,
                    second: 2
                });
                return launchAndFree_(pool, 'first')
                    .then(() => launchAndFree_(pool, 'second'))
                    .then(() => launchAndFree_(pool, 'first'))
                    .then(() => pool.getBrowser('second', opts))
                    .then(() => assert.calledOnce(createSecondBrowser));
            });
        });
    }

    describe('freeBrowser', () => {
        it('should free if next test requires specific browser version and limit has reached', () => {
            const browser = stubBrowser('bro', '10.1');
            const pool = makePool_();
            const freeOpts = {
                compositeIdForNextRequest: buildCompositeBrowserId('bro', '10.1'),
                hasFreeSlots: false
            };

            return pool.freeBrowser(browser, freeOpts)
                .then(() => assert.calledOnce(underlyingPool.freeBrowser));
        });

        it('should NOT free if next test requires specific browser version and limit has NOT reached', () => {
            const browser = stubBrowser('bro', '10.1');
            const pool = makePool_();
            const freeOpts = {
                compositeIdForNextRequest: buildCompositeBrowserId('bro', '10.1'),
                hasFreeSlots: true
            };

            return pool.freeBrowser(browser, freeOpts)
                .then(() => assert.notCalled(underlyingPool.freeBrowser));
        });

        it('should NOT free if next test requires specific browser version and there is cache', () => {
            const pool = makePool_();
            const freeOpts = {
                compositeIdForNextRequest: buildCompositeBrowserId('bro', '10.1'),
                hasFreeSlots: false
            };

            return pool.getBrowser('bro', {version: '10.1'})
                .then((browser) => pool.freeBrowser(browser, freeOpts))
                .then(() => assert.notCalled(underlyingPool.freeBrowser));
        });
    });

    describe('cancel', () => {
        it('should cancel an underlying pool', () => {
            const pool = makePool_();

            pool.cancel();

            assert.calledOnce(underlyingPool.cancel);
        });
    });
});
