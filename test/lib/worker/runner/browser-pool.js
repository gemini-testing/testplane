'use strict';

const EventEmitter = require('events').EventEmitter;
const {Calibrator} = require('gemini-core');
const _ = require('lodash');
const Browser = require('lib/browser/existing-browser');
const BrowserPool = require('lib/worker/runner/browser-pool');
const RunnerEvents = require('lib/worker/constants/runner-events');
const logger = require('lib/utils/logger');
const ipc = require('lib/utils/ipc');

describe('worker/browser-pool', () => {
    const sandbox = sinon.sandbox.create();

    const stubConfig = (browserConfig) => {
        return {
            forBrowser: () => browserConfig || {}
        };
    };

    const createPool = (opts) => {
        opts = _.defaults(opts || {}, {
            config: stubConfig(),
            emitter: new EventEmitter()
        });

        return BrowserPool.create(opts.config, opts.emitter);
    };

    const stubBrowser = (opts) => {
        const bro = _.defaults(opts || {}, {
            state: {isBroken: false}
        });

        bro.init = sandbox.stub().resolves();
        bro.reinit = sandbox.stub().resolves(bro);
        bro.quit = sandbox.stub();
        bro.markAsBroken = sandbox.stub();

        return bro;
    };

    beforeEach(() => {
        sandbox.stub(logger, 'warn');
        sandbox.stub(Browser, 'create');
        sandbox.stub(ipc, 'emit');
    });

    afterEach(() => sandbox.restore());

    describe('getBrowser', () => {
        it('should create browser with correct args', async () => {
            const config = stubConfig();
            const emitter = new EventEmitter();
            const browserPool = createPool({config, emitter});
            const browser = stubBrowser({browserId: 'bro-id'});
            Browser.create.withArgs(config, 'bro-id', undefined, emitter).returns(browser);

            await browserPool.getBrowser('bro-id');

            assert.calledOnceWith(Browser.create, config, 'bro-id', undefined, emitter);
        });

        it('should create specific version of browser with correct args', async () => {
            const config = stubConfig();
            const emitter = new EventEmitter();
            const browserPool = createPool({config, emitter});
            const browser = stubBrowser({browserId: 'bro-id'});
            Browser.create.withArgs(config, 'bro-id', '10.1', emitter).returns(browser);

            await browserPool.getBrowser('bro-id', '10.1');

            assert.calledOnceWith(Browser.create, config, 'bro-id', '10.1', emitter);
        });

        it('should create a new browser if there are no free browsers in a cache', () => {
            const config = stubConfig();
            const browserPool = createPool({config});
            const browser = stubBrowser({browserId: 'bro-id'});

            Browser.create.withArgs(config, 'bro-id').returns(browser);

            return assert.becomes(browserPool.getBrowser('bro-id'), browser);
        });

        it('should create a new browser with specific version if there are no free browsers in a cache', () => {
            const config = stubConfig();
            const browserPool = createPool({config});
            const browser = stubBrowser({browserId: 'bro-id'});

            Browser.create.withArgs(config, 'bro-id', '10.1').returns(browser);

            return assert.becomes(browserPool.getBrowser('bro-id', '10.1'), browser);
        });

        it('should init a new created browser if there are no free browsers in a cache', () => {
            const browser = stubBrowser({browserId: 'bro-id'});

            Browser.create.returns(browser);

            return createPool().getBrowser('bro-id', null, '100-500')
                .then(() => assert.calledOnceWith(browser.init, '100-500', sinon.match.instanceOf(Calibrator)));
        });

        it('should emit "NEW_BROWSER" event on creating of a browser', () => {
            const emitter = new EventEmitter();
            const onNewBrowser = sandbox.spy().named('onNewBrowser');
            const browserPool = createPool({emitter});

            emitter.on(RunnerEvents.NEW_BROWSER, onNewBrowser);

            Browser.create.returns(stubBrowser({id: 'bro-id', publicAPI: {some: 'api'}}));

            return browserPool.getBrowser('bro-id', '10.1')
                .then(() => assert.calledOnceWith(onNewBrowser, {some: 'api'}, {browserId: 'bro-id', browserVersion: '10.1'}));
        });

        it('should not create a new browser if there is a free browser in a cache', () => {
            const browserPool = createPool();

            Browser.create.returns(stubBrowser());

            return browserPool.getBrowser('bro-id', null, '100-500')
                .then((browser) => {
                    browserPool.freeBrowser(browser);
                    Browser.create.resetHistory();

                    return browserPool.getBrowser('bro-id', null, '500-100')
                        .then((anotherBrowser) => {
                            assert.deepEqual(browser, anotherBrowser);
                            assert.notCalled(Browser.create);
                        });
                });
        });

        it('should not create a new browser if there is a free browser in a cache with same version', () => {
            const browserPool = createPool();

            Browser.create.returns(stubBrowser({version: '1.1'}));

            return browserPool.getBrowser('bro-id', '1.1', '100-500')
                .then((browser) => {
                    browserPool.freeBrowser(browser);
                    Browser.create.resetHistory();

                    return browserPool.getBrowser('bro-id', '1.1', '500-100')
                        .then((anotherBrowser) => {
                            assert.deepEqual(browser, anotherBrowser);
                            assert.notCalled(Browser.create);
                        });
                });
        });

        it('should reinit a given session to a free browser in a cache', () => {
            const browserPool = createPool();

            Browser.create.returns(stubBrowser());

            return browserPool.getBrowser('bro-id', null, '100-500')
                .then((browser) => {
                    browserPool.freeBrowser(browser);

                    return browserPool.getBrowser('bro-id', null, '500-100')
                        .then((anotherBrowser) => assert.calledOnceWith(anotherBrowser.reinit, '500-100'));
                });
        });

        it('should not emit "NEW_BROWSER" event on getting of a free browser from a cache', () => {
            const emitter = new EventEmitter();
            const onNewBrowser = sandbox.spy().named('onNewBrowser');
            const browserPool = createPool({emitter});

            Browser.create.returns(stubBrowser());

            emitter.on(RunnerEvents.NEW_BROWSER, onNewBrowser);

            return browserPool.getBrowser('bro-id')
                .then((browser) => {
                    browserPool.freeBrowser(browser);

                    onNewBrowser.reset();

                    return browserPool.getBrowser('bro-id')
                        .then(() => assert.notCalled(onNewBrowser));
                });
        });

        describe('getting of browser fails', () => {
            beforeEach(() => {
                sandbox.spy(BrowserPool.prototype, 'freeBrowser');
            });

            it('should be rejected if instance of browser was not created', () => {
                Browser.create.throws(new Error('foo bar'));

                return assert.isRejected(createPool().getBrowser(), /foo bar/);
            });

            describe('init fails', () => {
                const stubBrowserWhichRejectsOnInit = (params = {}) => {
                    const browser = stubBrowser(params);
                    Browser.create.returns(browser);

                    browser.init.rejects();

                    return browser;
                };

                it('should mark browser as broken', async () => {
                    const browser = stubBrowserWhichRejectsOnInit({id: 'bro-id'});

                    await createPool().getBrowser('bro-id').catch((e) => e);

                    assert.calledOnceWith(browser.markAsBroken);
                });

                it('should extend browser with session id', async () => {
                    const browser = stubBrowserWhichRejectsOnInit({id: 'bro-id'});

                    await createPool().getBrowser('bro-id', null, '100500').catch((e) => e);

                    assert.equal(browser.sessionId, '100500');
                });

                it('should extend browser with session id and browser version', async () => {
                    const browser = stubBrowserWhichRejectsOnInit({id: 'bro-id', version: '10.1'});

                    await createPool().getBrowser('bro-id', '10.1', '100500').catch((e) => e);

                    assert.equal(browser.version, '10.1');
                });

                it('should free browser', async () => {
                    const browser = stubBrowserWhichRejectsOnInit({id: 'bro-id'});

                    await createPool().getBrowser('bro-id').catch((e) => e);

                    assert.calledOnceWith(BrowserPool.prototype.freeBrowser, browser);
                });

                it('should free browser after marking browser as broken', async () => {
                    const browser = stubBrowserWhichRejectsOnInit({id: 'bro-id'});

                    await createPool().getBrowser('bro-id').catch((e) => e);

                    assert.callOrder(browser.markAsBroken, BrowserPool.prototype.freeBrowser);
                });

                it('should be rejected with error extended by browser meta', async () => {
                    stubBrowserWhichRejectsOnInit({id: 'bro-id', meta: {foo: 'bar'}});

                    const error = await createPool().getBrowser('bro-id').catch((e) => e);

                    assert.deepEqual(error.meta, {foo: 'bar'});
                });
            });

            describe('reinit fails', () => {
                const stubBrowserWhichRejectsOnReinit = (params = {}) => {
                    const browser = stubBrowser(params);
                    Browser.create.returns(browser);

                    browser.reinit.rejects();

                    return browser;
                };

                it('should mark browser as broken', async () => {
                    const browser = stubBrowserWhichRejectsOnReinit({id: 'bro-id'});
                    const browserPool = createPool();

                    await browserPool.getBrowser('bro-id');
                    await browserPool.freeBrowser(browser);
                    await browserPool.getBrowser('bro-id').catch((e) => e);

                    assert.calledOnce(browser.markAsBroken);
                });

                it('should extend browser with session id', async () => {
                    const browser = stubBrowserWhichRejectsOnReinit({id: 'bro-id'});
                    const browserPool = createPool();

                    await browserPool.getBrowser('bro-id');
                    await browserPool.freeBrowser(browser);
                    await browserPool.getBrowser('bro-id', null, '100500').catch((e) => e);

                    assert.equal(browser.sessionId, '100500');
                });

                it('should free browser', async () => {
                    const browser = stubBrowserWhichRejectsOnReinit({id: 'bro-id'});
                    const browserPool = createPool();

                    await browserPool.getBrowser('bro-id');
                    await browserPool.freeBrowser(browser);
                    browserPool.freeBrowser.resetHistory();
                    await browserPool.getBrowser('bro-id').catch((e) => e);

                    assert.calledOnceWith(browserPool.freeBrowser, browser);
                });

                it('should free browser after marking browser as broken', async () => {
                    const browser = stubBrowserWhichRejectsOnReinit({id: 'bro-id'});
                    const browserPool = createPool();

                    await browserPool.getBrowser('bro-id');
                    await browserPool.freeBrowser(browser);
                    browserPool.freeBrowser.resetHistory();
                    await browserPool.getBrowser('bro-id').catch((e) => e);

                    assert.callOrder(browser.markAsBroken, browserPool.freeBrowser);
                });

                it('should be rejected with error extended by browser meta', async () => {
                    const browser = stubBrowserWhichRejectsOnReinit({id: 'bro-id', meta: {foo: 'bar'}});
                    const browserPool = createPool();

                    await browserPool.getBrowser('bro-id');
                    await browserPool.freeBrowser(browser);
                    const error = await browserPool.getBrowser('bro-id').catch((e) => e);

                    assert.deepEqual(error.meta, {foo: 'bar'});
                });
            });
        });
    });

    describe('freeBrowser', () => {
        it('should create a new browser if there is a broken browser in a cache', () => {
            const browserPool = createPool();

            Browser.create.returns(stubBrowser({id: 'bro-id', state: {isBroken: true}}));

            return browserPool.getBrowser('bro-id', '100-500')
                .then((browser) => {
                    browserPool.freeBrowser(browser);
                    Browser.create.resetHistory();

                    return browserPool.getBrowser('bro-id', '500-100')
                        .then(() => assert.calledOnce(Browser.create));
                });
        });

        it('should set session id to "null"', () => {
            const browserPool = createPool();

            Browser.create.returns(stubBrowser());

            return browserPool.getBrowser('bro-id', '100-500')
                .then((browser) => {
                    browserPool.freeBrowser(browser);

                    assert.calledOnce(browser.quit);
                });
        });

        it('should send test related freeBrowser event on browser release', async () => {
            createPool().freeBrowser(stubBrowser({sessionId: '100500', state: {foo: 'bar'}}));

            assert.calledOnceWith(ipc.emit, 'worker.100500.freeBrowser', {foo: 'bar'});
        });
    });
});
