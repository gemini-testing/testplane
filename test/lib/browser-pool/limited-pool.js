'use strict';
var q = require('q'),
    LimitedPool = require('../../../lib/browser-pool/limited-pool'),

    browserWithId = require('../../utils').browserWithId;

describe('Limited pool', function() {
    var sandbox = sinon.sandbox.create(),
        makeBrowser = browserWithId.bind(this, 'id'),
        underlyingPool;

    function makePool(limit) {
        return new LimitedPool(limit || 1, underlyingPool);
    }

    beforeEach(function() {
        underlyingPool = {
            getBrowser: sinon.stub(),
            freeBrowser: sinon.stub().returns(q())
        };
    });

    afterEach(function() {
        sandbox.restore();
    });

    it('should request browser from underlying pool', function() {
        var browser = makeBrowser(),
            pool = makePool();

        underlyingPool.getBrowser.returns(q(browser));

        return assert.eventually.equal(pool.getBrowser('id'), browser);
    });

    it('should return browser to underlying pool when freed', function() {
        var browser = makeBrowser(),
            pool = makePool();

        return pool.freeBrowser(browser).then(function() {
            assert.calledWith(underlyingPool.freeBrowser, browser);
        });
    });

    it('should launch next request from queue on fail to receive browser from underlying pool', function() {
        var browser = makeBrowser(),
            pool = makePool();

        underlyingPool.getBrowser.onFirstCall().returns(q.reject());
        underlyingPool.getBrowser.onSecondCall().returns(browser);

        pool.getBrowser('id');

        assert.eventually.equal(pool.getBrowser('id'), browser);
    });

    describe('limit', function() {
        it('should launch all browser in limit', function() {
            var pool = makePool(2);

            underlyingPool.getBrowser
                .withArgs('first').returns(q(makeBrowser()))
                .withArgs('second').returns(q(makeBrowser()));

            return q.all([pool.getBrowser('first'), pool.getBrowser('second')])
                .then(function() {
                    assert.calledTwice(underlyingPool.getBrowser);
                    assert.calledWith(underlyingPool.getBrowser, 'first');
                    assert.calledWith(underlyingPool.getBrowser, 'second');
                });
        });

        it('should not launch browsers out of limit', function() {
            underlyingPool.getBrowser.returns(q(makeBrowser()));

            var pool = makePool(1),
                result = pool.getBrowser('first')
                    .then(function() {
                        return pool.getBrowser('second').timeout(100, 'timeout');
                    });

            return assert.isRejected(result, Error);
        });

        it('should launch next browsers after previous are released', function() {
            var expectedBrowser = makeBrowser(),
                pool = makePool(1);

            underlyingPool.getBrowser
                .withArgs('first').returns(q(makeBrowser()))
                .withArgs('second').returns(q(expectedBrowser));

            var result = pool.getBrowser('first')
                .then(function(browser) {
                    return pool.freeBrowser(browser);
                })
                .then(function() {
                    return pool.getBrowser('second');
                });

            return assert.eventually.equal(result, expectedBrowser);
        });

        it('should launch queued browser when previous are released', function() {
            var expectedBrowser = makeBrowser(),
                pool = makePool(1);

            underlyingPool.getBrowser
                .withArgs('first').returns(q(makeBrowser()))
                .withArgs('second').returns(q(expectedBrowser));

            var result = pool.getBrowser('first')
                .then(function(browser) {
                    var secondPromise = pool.getBrowser('second');
                    return q.delay(100)
                        .then(function() {
                            return pool.freeBrowser(browser);
                        })
                        .then(function() {
                            return secondPromise;
                        });
                });

            return assert.eventually.equal(result, expectedBrowser);
        });

        it('should launch next browsers if free failed', function() {
            var expectedBrowser = makeBrowser(),
                pool = makePool(1);

            underlyingPool.getBrowser
                .withArgs('first').returns(q(makeBrowser()))
                .withArgs('second').returns(q(expectedBrowser));

            underlyingPool.freeBrowser.returns(q.reject('error'));

            var result = pool.getBrowser('first')
                .then(function(browser) {
                    var secondPromise = pool.getBrowser('second');
                    return q.delay(100)
                        .then(function() {
                            return pool.freeBrowser(browser);
                        })
                        .fail(function() {
                            return secondPromise;
                        });
                });

            return assert.eventually.equal(result, expectedBrowser);
        });

        it('should not wait for queued browser to start after release browser', function() {
            var pool = makePool(1),
                afterFree = sinon.spy().named('afterFree'),
                afterSecondGet = sinon.spy().named('afterSecondGet');

            underlyingPool.getBrowser
                .withArgs('first').returns(q(makeBrowser()))
                .withArgs('second').returns(q.resolve());

            return pool.getBrowser('first')
                .then(function(browser) {
                    pool.getBrowser('second')
                        .then(afterSecondGet);

                    return q.delay(100)
                        .then(function() {
                            return pool.freeBrowser(browser);
                        })
                        .then(afterFree)
                        .then(function() {
                            assert.callOrder(
                                afterFree,
                                afterSecondGet
                            );
                        });
                });
        });

        it('should reject the queued call when underlying pool rejects the request', function() {
            var pool = makePool(),
                error = new Error('You shall not pass');

            underlyingPool.getBrowser
                .onFirstCall().returns(q(makeBrowser()))
                .onSecondCall().returns(q.reject(error));

            return pool.getBrowser('id')
                .then(function(browser) {
                    var secondRequest = pool.getBrowser('id');
                    return pool.freeBrowser(browser)
                        .then(function() {
                            return assert.isRejected(secondRequest, error);
                        });
                });
        });
    });
});
