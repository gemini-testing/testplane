'use strict';

const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
const Browser = require('src/browser/existing-browser');
const BrowserPool = require('src/worker/runner/browser-pool');
const Calibrator = require('src/browser/calibrator');
const RunnerEvents = require('src/worker/constants/runner-events');
const logger = require('src/utils/logger');
const ipc = require('src/utils/ipc');
const {WEBDRIVER_PROTOCOL, DEVTOOLS_PROTOCOL} = require('src/constants/config');

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

    [WEBDRIVER_PROTOCOL, DEVTOOLS_PROTOCOL].forEach((automationProtocol) => {
        describe(`with using "${automationProtocol}" protocol`, () => {
            let config;

            beforeEach(() => {
                config = stubConfig({automationProtocol});
            });

            describe('getBrowser', () => {
                it('should create browser with correct args', async () => {
                    const emitter = new EventEmitter();
                    const browserPool = createPool({config, emitter});
                    const browser = stubBrowser({browserId: 'bro-id'});
                    Browser.create.withArgs(config, 'bro-id', undefined, emitter).returns(browser);

                    await browserPool.getBrowser({browserId: 'bro-id'});

                    assert.calledOnceWith(Browser.create, config, 'bro-id', undefined, emitter);
                });

                it('should create specific version of browser with correct args', async () => {
                    const emitter = new EventEmitter();
                    const browserPool = createPool({config, emitter});
                    const browser = stubBrowser({browserId: 'bro-id'});
                    Browser.create.withArgs(config, 'bro-id', '10.1', emitter).returns(browser);

                    await browserPool.getBrowser({browserId: 'bro-id', browserVersion: '10.1'});

                    assert.calledOnceWith(Browser.create, config, 'bro-id', '10.1', emitter);
                });

                it('should create a new browser if there are no free browsers in a cache', () => {
                    const browserPool = createPool({config});
                    const browser = stubBrowser({browserId: 'bro-id'});

                    Browser.create.withArgs(config, 'bro-id').returns(browser);

                    return assert.becomes(browserPool.getBrowser({browserId: 'bro-id'}), browser);
                });

                it('should create a new browser with specific version if there are no free browsers in a cache', () => {
                    const browserPool = createPool({config});
                    const browser = stubBrowser({browserId: 'bro-id'});

                    Browser.create.withArgs(config, 'bro-id', '10.1').returns(browser);

                    return assert.becomes(browserPool.getBrowser({browserId: 'bro-id', browserVersion: '10.1'}), browser);
                });

                it('should init a new created browser if there are no free browsers in a cache', async () => {
                    const browser = stubBrowser({browserId: 'bro-id'});

                    Browser.create.returns(browser);

                    await createPool({config}).getBrowser({
                        browserId: 'bro-id', sessionId: '100-500', sessionCaps: 'some-caps', sessionOpts: 'some-opts'
                    });

                    assert.calledOnceWith(
                        browser.init,
                        {sessionId: '100-500', sessionCaps: 'some-caps', sessionOpts: 'some-opts'},
                        sinon.match.instanceOf(Calibrator)
                    );
                });

                it('should emit "NEW_BROWSER" event on creating of a browser', async () => {
                    const emitter = new EventEmitter();
                    const onNewBrowser = sandbox.spy().named('onNewBrowser');
                    const browserPool = createPool({config, emitter});

                    emitter.on(RunnerEvents.NEW_BROWSER, onNewBrowser);

                    Browser.create.returns(stubBrowser({id: 'bro-id', publicAPI: {some: 'api'}}));

                    await browserPool.getBrowser({browserId: 'bro-id', browserVersion: '10.1'});

                    assert.calledOnceWith(onNewBrowser, {some: 'api'}, {browserId: 'bro-id', browserVersion: '10.1'});
                });

                describe('getting of browser fails', () => {
                    beforeEach(() => {
                        sandbox.spy(BrowserPool.prototype, 'freeBrowser');
                    });

                    it('should be rejected if instance of browser was not created', () => {
                        Browser.create.throws(new Error('foo bar'));

                        return assert.isRejected(createPool({config}).getBrowser({}), /foo bar/);
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

                            await createPool({config}).getBrowser({browserId: 'bro-id'}).catch((e) => e);

                            assert.calledOnceWith(browser.markAsBroken);
                        });

                        it('should extend browser with session id', async () => {
                            const browser = stubBrowserWhichRejectsOnInit({id: 'bro-id'});

                            await createPool({config}).getBrowser({browserId: 'bro-id', sessionId: '100500'}).catch((e) => e);

                            assert.equal(browser.sessionId, '100500');
                        });

                        it('should extend browser with session id and browser version', async () => {
                            const browser = stubBrowserWhichRejectsOnInit({id: 'bro-id', version: '10.1'});

                            await createPool({config})
                                .getBrowser({browserId: 'bro-id', browserVersion: '10.1', sessionId: '100500'})
                                .catch((e) => e);

                            assert.equal(browser.version, '10.1');
                        });

                        it('should free browser', async () => {
                            const browser = stubBrowserWhichRejectsOnInit({id: 'bro-id'});

                            await createPool({config}).getBrowser({browserId: 'bro-id'}).catch((e) => e);

                            assert.calledOnceWith(BrowserPool.prototype.freeBrowser, browser);
                        });

                        it('should free browser after marking browser as broken', async () => {
                            const browser = stubBrowserWhichRejectsOnInit({id: 'bro-id'});

                            await createPool({config}).getBrowser({browserId: 'bro-id'}).catch((e) => e);

                            assert.callOrder(browser.markAsBroken, BrowserPool.prototype.freeBrowser);
                        });

                        it('should be rejected with error extended by browser meta', async () => {
                            stubBrowserWhichRejectsOnInit({id: 'bro-id', meta: {foo: 'bar'}});

                            const error = await createPool({config}).getBrowser({browserId: 'bro-id'}).catch((e) => e);

                            assert.deepEqual(error.meta, {foo: 'bar'});
                        });
                    });
                });
            });

            describe('freeBrowser', () => {
                it('should set session id to "null"', async () => {
                    const browserPool = createPool({config});

                    Browser.create.returns(stubBrowser());

                    const browser = await browserPool.getBrowser({browserId: 'bro-id'});
                    browserPool.freeBrowser(browser);

                    assert.calledOnce(browser.quit);
                });

                it('should send test related freeBrowser event on browser release', async () => {
                    await createPool({config}).freeBrowser(stubBrowser({sessionId: '100500', state: {foo: 'bar'}}));

                    assert.calledOnceWith(ipc.emit, 'worker.100500.freeBrowser', {foo: 'bar'});
                });
            });
        });
    });

    describe(`with using "${WEBDRIVER_PROTOCOL}" protocol`, () => {
        let config;

        beforeEach(() => {
            config = stubConfig({automationProtocol: WEBDRIVER_PROTOCOL});
        });

        describe('getBrowser', () => {
            it('should not create a new browser if there is a free browser in a cache', async () => {
                const browserPool = createPool({config});

                Browser.create.returns(stubBrowser());

                const browser = await browserPool.getBrowser({browserId: 'bro-id', sessionId: '100-500'});
                browserPool.freeBrowser(browser);
                Browser.create.resetHistory();

                const anotherBrowser = await browserPool.getBrowser({browserId: 'bro-id', sessionsId: '500-100'});
                assert.deepEqual(browser, anotherBrowser);
                assert.notCalled(Browser.create);
            });

            it('should not create a new browser if there is a free browser in a cache with same version', async () => {
                const browserPool = createPool({config});
                Browser.create.returns(stubBrowser({version: '1.1'}));

                const browser = await browserPool.getBrowser({
                    browserId: 'bro-id', browserVersion: '1.1', sessionId: '100-500'
                });
                browserPool.freeBrowser(browser);
                Browser.create.resetHistory();

                const anotherBrowser = await browserPool.getBrowser({
                    browserId: 'bro-id', browserVersion: '1.1', sessionId: '500-100'
                });
                assert.deepEqual(browser, anotherBrowser);
                assert.notCalled(Browser.create);
            });

            it('should reinit a given session to a free browser in a cache', async () => {
                const browserPool = createPool({config});
                Browser.create.returns(stubBrowser());

                const browser = await browserPool.getBrowser({
                    browserId: 'bro-id',
                    sessionId: '100-500',
                    sessionOpts: {foo: 'bar'}
                });
                browserPool.freeBrowser(browser);

                const anotherBrowser = await browserPool.getBrowser({
                    browserId: 'bro-id',
                    sessionId: '500-100',
                    sessionOpts: {bar: 'foo'}
                });
                assert.calledOnceWith(anotherBrowser.reinit, '500-100', {bar: 'foo'});
            });

            it('should not emit "NEW_BROWSER" event on getting of a free browser from a cache', async () => {
                const emitter = new EventEmitter();
                const onNewBrowser = sandbox.spy().named('onNewBrowser');
                const browserPool = createPool({config, emitter});

                Browser.create.returns(stubBrowser());

                emitter.on(RunnerEvents.NEW_BROWSER, onNewBrowser);

                const browser = await browserPool.getBrowser({browserId: 'bro-id'});
                browserPool.freeBrowser(browser);

                onNewBrowser.resetHistory();

                await browserPool.getBrowser({browserId: 'bro-id'});
                assert.notCalled(onNewBrowser);
            });

            describe('reinit fails', () => {
                beforeEach(() => {
                    sandbox.spy(BrowserPool.prototype, 'freeBrowser');
                });

                const stubBrowserWhichRejectsOnReinit = (params = {}) => {
                    const browser = stubBrowser(params);
                    Browser.create.returns(browser);

                    browser.reinit.rejects();

                    return browser;
                };

                it('should mark browser as broken', async () => {
                    const browser = stubBrowserWhichRejectsOnReinit({id: 'bro-id'});
                    const browserPool = createPool({config});

                    await browserPool.getBrowser({browserId: 'bro-id'});
                    await browserPool.freeBrowser(browser);
                    await browserPool.getBrowser({browserId: 'bro-id'}).catch((e) => e);

                    assert.calledOnce(browser.markAsBroken);
                });

                it('should extend browser with session id', async () => {
                    const browser = stubBrowserWhichRejectsOnReinit({id: 'bro-id'});
                    const browserPool = createPool({config});

                    await browserPool.getBrowser({browserId: 'bro-id'});
                    await browserPool.freeBrowser(browser);
                    await browserPool.getBrowser({browserId: 'bro-id', sessionId: '100500'}).catch((e) => e);

                    assert.equal(browser.sessionId, '100500');
                });

                it('should free browser', async () => {
                    const browser = stubBrowserWhichRejectsOnReinit({id: 'bro-id'});
                    const browserPool = createPool({config});

                    await browserPool.getBrowser({browserId: 'bro-id'});
                    await browserPool.freeBrowser(browser);
                    browserPool.freeBrowser.resetHistory();
                    await browserPool.getBrowser({browserId: 'bro-id'}).catch((e) => e);

                    assert.calledOnceWith(browserPool.freeBrowser, browser);
                });

                it('should free browser after marking browser as broken', async () => {
                    const browser = stubBrowserWhichRejectsOnReinit({id: 'bro-id'});
                    const browserPool = createPool({config});

                    await browserPool.getBrowser({browserId: 'bro-id'});
                    await browserPool.freeBrowser(browser);
                    browserPool.freeBrowser.resetHistory();
                    await browserPool.getBrowser({browserId: 'bro-id'}).catch((e) => e);

                    assert.callOrder(browser.markAsBroken, browserPool.freeBrowser);
                });

                it('should be rejected with error extended by browser meta', async () => {
                    const browser = stubBrowserWhichRejectsOnReinit({id: 'bro-id', meta: {foo: 'bar'}});
                    const browserPool = createPool({config});

                    await browserPool.getBrowser({browserId: 'bro-id'});
                    await browserPool.freeBrowser(browser);
                    const error = await browserPool.getBrowser({browserId: 'bro-id'}).catch((e) => e);

                    assert.deepEqual(error.meta, {foo: 'bar'});
                });
            });
        });

        describe('freeBrowser', () => {
            it('should create a new browser if there is a broken browser in a cache', async () => {
                const browserPool = createPool({config});

                Browser.create.returns(stubBrowser({id: 'bro-id', state: {isBroken: true}}));

                const browser = await browserPool.getBrowser({browserId: 'bro-id'});
                browserPool.freeBrowser(browser);
                Browser.create.resetHistory();

                await browserPool.getBrowser({browserId: 'bro-id'});
                assert.calledOnce(Browser.create);
            });
        });
    });

    describe(`with using "${DEVTOOLS_PROTOCOL}" protocol`, () => {
        let config;

        beforeEach(() => {
            config = stubConfig({automationProtocol: DEVTOOLS_PROTOCOL});
        });

        describe('getBrowser', () => {
            it('should always create a new browser', async () => {
                const browserPool = createPool({config});
                Browser.create
                    .onFirstCall().returns(stubBrowser({foo: 1}))
                    .onSecondCall().returns(stubBrowser({foo: 2}));

                const browser = await browserPool.getBrowser({browserId: 'bro-id', sessionId: '100-500'});
                browserPool.freeBrowser(browser);

                const anotherBrowser = await browserPool.getBrowser({browserId: 'bro-id', sessionsId: '500-100'});
                assert.notEqual(browser, anotherBrowser);
                assert.calledTwice(Browser.create);
            });

            it('should never reinit a given session', async () => {
                const browserPool = createPool({config});
                Browser.create.returns(stubBrowser());

                const browser = await browserPool.getBrowser({browserId: 'bro-id', sessionId: '100-500'});
                browserPool.freeBrowser(browser);

                const anotherBrowser = await browserPool.getBrowser({browserId: 'bro-id', sessionId: '500-100'});
                assert.notCalled(anotherBrowser.reinit);
            });

            it('should always emit "NEW_BROWSER" event without using cache', async () => {
                const emitter = new EventEmitter();
                const onNewBrowser = sandbox.spy().named('onNewBrowser');
                const browserPool = createPool({config, emitter});

                Browser.create.returns(stubBrowser());

                emitter.on(RunnerEvents.NEW_BROWSER, onNewBrowser);

                const browser = await browserPool.getBrowser({browserId: 'bro-id'});
                browserPool.freeBrowser(browser);

                await browserPool.getBrowser({browserId: 'bro-id'});

                assert.calledTwice(onNewBrowser);
            });
        });
    });
});
