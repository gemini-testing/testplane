'use strict';

const {EventEmitter} = require('events');
const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const BasicPool = require('lib/worker/runner/browser-pool/basic');
const {makeConfigStub} = require('../../../../utils');

describe('worker/runner/browser-pool/caching', () => {
    const sandbox = sinon.sandbox.create();
    let CachingPool;

    const mkPool_ = (opts) => {
        opts = _.defaults(opts || {}, {
            config: makeConfigStub(),
            emitter: new EventEmitter()
        });

        return CachingPool.create(opts.config, opts.emitter);
    };

    const mkBrowser_ = (opts) => {
        const bro = {
            id: opts.browserId || null,
            version: opts.browserVersion || null,
            sessionId: opts.sessionId || null,
            state: opts.state || {isBroken: false},
            meta: opts.meta || {}
        };

        bro.reinit = sandbox.stub().resolves(bro);
        bro.markAsBroken = sandbox.stub();

        return bro;
    };

    beforeEach(() => {
        sandbox.stub(BasicPool.prototype, 'getBrowser').resolves();
        sandbox.stub(BasicPool.prototype, 'freeBrowser').returns();

        CachingPool = proxyquire('lib/worker/runner/browser-pool/caching', {
            './basic': BasicPool
        });
    });

    afterEach(() => sandbox.restore());

    describe('getBrowser', () => {
        describe('if there are no free browsers in a cache', () => {
            it('should create a new browser', async () => {
                const browserPool = mkPool_();
                const browserOpts = {browserId: 'bro-id'};
                const browser = mkBrowser_(browserOpts);
                BasicPool.prototype.getBrowser.withArgs(browserOpts).resolves(browser);

                await assert.becomes(browserPool.getBrowser(browserOpts), browser);
            });

            it('should create a new browser with specific version', async () => {
                const browserPool = mkPool_();
                const browserOpts = {browserId: 'bro-id', browserVersion: '10.1'};
                const browser = mkBrowser_(browserOpts);
                BasicPool.prototype.getBrowser.withArgs(browserOpts).resolves(browser);

                await assert.becomes(browserPool.getBrowser(browserOpts), browser);
            });
        });

        describe('if there is a free browser in a cache', () => {
            [
                {name: 'without specific version', broOpts: {}},
                {name: 'with specific version', broOpts: {browserVersion: '1.1'}}
            ].forEach(({name, broOpts}) => {
                it(`should not create a new browser ${name}`, async () => {
                    const browserPool = mkPool_();
                    const browserOpts1 = {browserId: 'bro-id', sessionId: '100-500', ...broOpts};
                    const browserOpts2 = {browserId: 'bro-id', sessionId: '500-100', ...broOpts};

                    BasicPool.prototype.getBrowser
                        .withArgs(browserOpts1).resolves(mkBrowser_({browserId: browserOpts1.browserId, ...broOpts}))
                        .withArgs(browserOpts2).resolves(mkBrowser_({browserId: browserOpts2.browserId, ...broOpts}));

                    const browser = await browserPool.getBrowser(browserOpts1);
                    browserPool.freeBrowser(browser);
                    BasicPool.prototype.getBrowser.resetHistory();

                    const anotherBrowser = await browserPool.getBrowser(browserOpts2);

                    assert.deepEqual(browser, anotherBrowser);
                    assert.notCalled(BasicPool.prototype.getBrowser);
                });
            });
        });

        it('should reinit a given session to a free browser in a cache', async () => {
            const browserPool = mkPool_();
            const browserOpts1 = {browserId: 'bro-id', sessionId: '100-500', sessionOpts: {foo: 'bar'}};
            const browserOpts2 = {browserId: 'bro-id', sessionId: '500-100', sessionOpts: {bar: 'foo'}};

            BasicPool.prototype.getBrowser
                .withArgs(browserOpts1).resolves(mkBrowser_({browserId: browserOpts1.browserId}))
                .withArgs(browserOpts2).resolves(mkBrowser_({browserId: browserOpts2.browserId}));

            const browser = await browserPool.getBrowser(browserOpts1);
            browserPool.freeBrowser(browser);
            const anotherBrowser = await browserPool.getBrowser(browserOpts2);

            assert.calledOnceWith(anotherBrowser.reinit, browserOpts2.sessionId, browserOpts2.sessionOpts);
        });

        describe('getting of browser fails', () => {
            beforeEach(() => {
                sandbox.spy(CachingPool.prototype, 'freeBrowser');
            });

            describe('reinit fails', () => {
                const mkBrowserRejectsOnReinit = (params = {}) => {
                    const browser = mkBrowser_(params);
                    BasicPool.prototype.getBrowser.resolves(browser);

                    browser.reinit.rejects();

                    return browser;
                };

                it('should mark browser as broken', async () => {
                    const browserPool = mkPool_();
                    const browserOpts = {browserId: 'bro-id'};
                    const browser = mkBrowserRejectsOnReinit(browserOpts);

                    await browserPool.getBrowser(browserOpts);
                    browserPool.freeBrowser(browser);
                    await browserPool.getBrowser(browserOpts).catch((e) => e);

                    assert.calledOnce(browser.reinit);
                    assert.calledOnce(browser.markAsBroken);
                });

                it('should extend browser with session id', async () => {
                    const browserPool = mkPool_();
                    const browserOpts = {browserId: 'bro-id'};
                    const browser = mkBrowserRejectsOnReinit(browserOpts);

                    await browserPool.getBrowser(browserOpts);
                    browserPool.freeBrowser(browser);
                    await browserPool.getBrowser({...browserOpts, sessionId: '100500'}).catch((e) => e);

                    assert.equal(browser.sessionId, '100500');
                });

                it('should free browser', async () => {
                    const browserPool = mkPool_();
                    const browserOpts = {browserId: 'bro-id'};
                    const browser = mkBrowserRejectsOnReinit(browserOpts);

                    await browserPool.getBrowser(browserOpts);
                    browserPool.freeBrowser(browser);
                    browserPool.freeBrowser.resetHistory();
                    await browserPool.getBrowser(browserOpts).catch((e) => e);

                    assert.calledOnceWith(browserPool.freeBrowser, browser);
                });

                it('should free browser after marking browser as broken', async () => {
                    const browserPool = mkPool_();
                    const browserOpts = {browserId: 'bro-id'};
                    const browser = mkBrowserRejectsOnReinit(browserOpts);

                    await browserPool.getBrowser(browserOpts);
                    await browserPool.freeBrowser(browser);
                    browserPool.freeBrowser.resetHistory();
                    await browserPool.getBrowser(browserOpts).catch((e) => e);

                    assert.callOrder(browser.markAsBroken, browserPool.freeBrowser);
                });

                it('should be rejected with error extended by browser meta', async () => {
                    const browserPool = mkPool_();
                    const browserOpts = {browserId: 'bro-id'};
                    const browser = mkBrowserRejectsOnReinit({...browserOpts, meta: {foo: 'bar'}});

                    await browserPool.getBrowser(browserOpts);
                    await browserPool.freeBrowser(browser);
                    const error = await browserPool.getBrowser(browserOpts).catch((e) => e);

                    assert.deepEqual(error.meta, {foo: 'bar'});
                });
            });
        });
    });

    describe('freeBrowser', () => {
        it('should create a new browser if there is a broken browser in a cache', async () => {
            const browserPool = mkPool_();
            const browserOpts = {browserId: 'bro-id'};
            const browser = mkBrowser_({...browserOpts, state: {isBroken: true}});
            BasicPool.prototype.getBrowser.withArgs(browserOpts).resolves(browser);

            await browserPool.getBrowser(browserOpts);
            await browserPool.freeBrowser(browser);
            BasicPool.prototype.getBrowser.resetHistory();
            await browserPool.getBrowser(browserOpts);

            assert.calledOnce(BasicPool.prototype.getBrowser);
            assert.notCalled(browser.reinit);
        });
    });
});
