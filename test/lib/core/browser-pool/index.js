'use strict';

const BasicPool = require('lib/core/browser-pool/basic-pool');
const LimitedPool = require('lib/core/browser-pool/limited-pool');
const PerBrowserLimitedPool = require('lib/core/browser-pool/per-browser-limited-pool');
const pool = require('lib/core/browser-pool');
const _ = require('lodash');

describe('browser-pool', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    const mkConfig_ = (opts) => {
        return {
            system: opts && opts.system || {},
            forBrowser: sinon.stub().returns({id: 'id'}),
            getBrowserIds: sinon.stub().returns(['id'])
        };
    };

    const mkPool_ = (opts) => {
        opts = _.defaults(opts, {
            browserManager: {},
            config: mkConfig_()
        });

        return pool.create(opts.browserManager, opts);
    };

    it('should create basic pool', () => {
        const browserManager = {foo: 'bar'};
        const opts = {config: mkConfig_()};
        sandbox.spy(BasicPool, 'create');

        pool.create(browserManager, opts);

        assert.calledOnce(BasicPool.create);
        assert.calledWith(BasicPool.create, browserManager, opts);
    });

    it('should create pool according to perBrowserLimit by default', () => {
        const browserPool = mkPool_();

        assert.instanceOf(browserPool, PerBrowserLimitedPool);
    });

    it('should create pool according to parallelLimit if that option exist', () => {
        const config = mkConfig_({system: {parallelLimit: 10}});

        const browserPool = mkPool_({config});

        assert.instanceOf(browserPool, LimitedPool);
    });

    it('should ignore parallelLimit if its value is Infinity', () => {
        const config = mkConfig_({system: {parallelLimit: Infinity}});

        const browserPool = mkPool_({config});

        assert.instanceOf(browserPool, PerBrowserLimitedPool);
    });

    it('should ignore parallelLimit if its value is not set', () => {
        const config = mkConfig_({system: {}});

        const browserPool = mkPool_({config});

        assert.instanceOf(browserPool, PerBrowserLimitedPool);
    });
});
