'use strict';

const BrowserPoolManager = require('lib/worker/runner/browser-pool/manager');
const BasicBrowserPool = require('lib/worker/runner/browser-pool/basic');
const CachingBrowserPool = require('lib/worker/runner/browser-pool/caching');
const {DEVTOOLS_PROTOCOL, WEBDRIVER_PROTOCOL} = require('lib/constants/config');

describe('worker/runner/browser-pool/manager', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(BasicBrowserPool, 'create').returns(Object.create(BasicBrowserPool.prototype));
        sandbox.stub(CachingBrowserPool, 'create').returns(Object.create(CachingBrowserPool.prototype));
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create basic browser pool', () => {
            BrowserPoolManager.create('arg1', 'arg2');

            assert.calledOnceWith(BasicBrowserPool.create, 'arg1', 'arg2');
        });

        it('should create caching browser pool', () => {
            BrowserPoolManager.create('arg1', 'arg2');

            assert.calledOnceWith(CachingBrowserPool.create, 'arg1', 'arg2');
        });
    });

    describe('getPool', () => {
        it(`should return basic browser pool when using ${DEVTOOLS_PROTOCOL} protocol`, () => {
            const manager = BrowserPoolManager.create('arg1', 'arg2');

            assert.instanceOf(manager.getPool({automationProtocol: DEVTOOLS_PROTOCOL}), BasicBrowserPool);
        });

        it(`should return caching browser pool when using ${WEBDRIVER_PROTOCOL} protocol`, () => {
            const manager = BrowserPoolManager.create('arg1', 'arg2');

            assert.instanceOf(manager.getPool({automationProtocol: WEBDRIVER_PROTOCOL}), CachingBrowserPool);
        });
    });
});
