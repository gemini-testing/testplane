'use strict';

const _ = require('lodash');
const PerBrowserLimitedPool = require('build/core/browser-pool/per-browser-limited-pool');
const LimitedPool = require('build/core/browser-pool/limited-pool');
const BasicPool = require('build/core/browser-pool/basic-pool');
const stubBrowser = require('./util').stubBrowser;

describe('browser-pool/per-browser-limited-pool', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(LimitedPool, 'create').returns(sinon.createStubInstance(LimitedPool));
    });

    afterEach(() => sandbox.restore());

    const mkConfigStub_ = (browsers) => {
        return {
            getBrowserIds: () => _.keys(browsers),
            forBrowser: (id) => browsers[id]
        };
    };

    const makePool_ = (opts) => {
        return new PerBrowserLimitedPool(opts.underlyingPool, opts.config, {});
    };

    describe('constructor', () => {
        it('should create LimitedPool for each browser', () => {
            const config = mkConfigStub_({
                bro1: {parallelLimit: 1},
                bro2: {parallelLimit: 2}
            });
            const underlyingPool = sinon.createStubInstance(BasicPool);

            makePool_({underlyingPool, config});

            assert.calledTwice(LimitedPool.create);
            assert.calledWith(LimitedPool.create, underlyingPool, sinon.match({limit: 1}));
            assert.calledWith(LimitedPool.create, underlyingPool, sinon.match({limit: 2}));
        });
    });

    describe('getBrowser', () => {
        it('should redirect request to corresponding pool', () => {
            const config = mkConfigStub_({
                bro1: {parallelLimit: 1},
                bro2: {parallelLimit: 2}
            });

            const bro1Pool = sinon.createStubInstance(BasicPool);
            const bro2Pool = sinon.createStubInstance(BasicPool);

            LimitedPool.create
                .onFirstCall().returns(bro1Pool)
                .onSecondCall().returns(bro2Pool);

            const perBrowserLimitedPool = makePool_({config});

            perBrowserLimitedPool.getBrowser('bro1');

            assert.called(bro1Pool.getBrowser);
            assert.notCalled(bro2Pool.getBrowser);
        });

        it('should pass opts to pool', () => {
            const pool = sinon.createStubInstance(BasicPool);
            LimitedPool.create.returns(pool);

            const config = mkConfigStub_({
                bro: {parallelLimit: 1}
            });
            const perBrowserLimitedPool = makePool_({config});

            perBrowserLimitedPool.getBrowser('bro', {some: 'opt'});

            assert.calledOnceWith(pool.getBrowser, 'bro', {some: 'opt'});
        });
    });

    describe('freeBrowser', () => {
        it('should redirect request to corresponding pool', () => {
            const config = mkConfigStub_({
                bro1: {parallelLimit: 1},
                bro2: {parallelLimit: 2}
            });

            const bro1Pool = sinon.createStubInstance(BasicPool);
            const bro2Pool = sinon.createStubInstance(BasicPool);

            LimitedPool.create
                .onFirstCall().returns(bro1Pool)
                .onSecondCall().returns(bro2Pool);

            const perBrowserLimitedPool = makePool_({config});

            const browser = stubBrowser('bro1');

            perBrowserLimitedPool.freeBrowser(browser, {foo: 'bar'});

            assert.calledWith(bro1Pool.freeBrowser, browser, {foo: 'bar'});
            assert.notCalled(bro2Pool.freeBrowser);
        });
    });

    describe('cancel', () => {
        it('should cancel all underlying pools', () => {
            const config = mkConfigStub_({
                bro1: {parallelLimit: 1},
                bro2: {parallelLimit: 2}
            });

            const bro1Pool = sinon.createStubInstance(BasicPool);
            const bro2Pool = sinon.createStubInstance(BasicPool);

            LimitedPool.create
                .onFirstCall().returns(bro1Pool)
                .onSecondCall().returns(bro2Pool);

            const perBrowserLimitedPool = makePool_({config});

            perBrowserLimitedPool.cancel();

            assert.calledOnce(bro1Pool.cancel);
            assert.calledOnce(bro2Pool.cancel);
        });
    });
});
