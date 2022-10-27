'use strict';

const {EventEmitter} = require('events');
const _ = require('lodash');
const BasicPool = require('lib/worker/runner/browser-pool/basic');
const Browser = require('lib/browser/existing-browser');
const Calibrator = require('lib/core/calibrator');
const ipc = require('lib/utils/ipc');
const RunnerEvents = require('lib/worker/constants/runner-events');
const {makeConfigStub} = require('../../../../utils');

describe('worker/runner/browser-pool/basic', () => {
    const sandbox = sinon.sandbox.create();

    const mkPool_ = (opts) => {
        opts = _.defaults(opts || {}, {
            config: makeConfigStub(),
            emitter: new EventEmitter()
        });

        return BasicPool.create(opts.config, opts.emitter);
    };

    const mkBrowser_ = (opts) => {
        const bro = _.defaults(opts || {}, {
            state: {isBroken: false}
        });

        bro.init = sandbox.stub().resolves();
        bro.quit = sandbox.stub();
        bro.markAsBroken = sandbox.stub();

        return bro;
    };

    beforeEach(() => {
        sandbox.stub(Browser, 'create');
        sandbox.stub(ipc, 'emit');
    });

    afterEach(() => sandbox.restore());

    describe('getBrowser', () => {
        it('should create browser with correct args', async () => {
            const config = makeConfigStub();
            const emitter = new EventEmitter();
            const browserPool = mkPool_({config, emitter});
            const browser = mkBrowser_({browserId: 'bro-id'});
            Browser.create.withArgs(config, 'bro-id', undefined, emitter).returns(browser);

            await browserPool.getBrowser({browserId: 'bro-id'});

            assert.calledOnceWith(Browser.create, config, 'bro-id', undefined, emitter);
        });

        it('should create specific version of browser with correct args', async () => {
            const config = makeConfigStub();
            const emitter = new EventEmitter();
            const browserPool = mkPool_({config, emitter});
            const browser = mkBrowser_({browserId: 'bro-id'});
            Browser.create.withArgs(config, 'bro-id', '10.1', emitter).returns(browser);

            await browserPool.getBrowser({browserId: 'bro-id', browserVersion: '10.1'});

            assert.calledOnceWith(Browser.create, config, 'bro-id', '10.1', emitter);
        });

        it('should init a new created browser', async () => {
            const browser = mkBrowser_({browserId: 'bro-id'});
            Browser.create.returns(browser);

            await mkPool_().getBrowser({browserId: 'bro-id', sessionId: '100-500', sessionCaps: 'some-caps', sessionOpts: 'some-opts'});

            assert.calledOnceWith(
                browser.init,
                {sessionId: '100-500', sessionCaps: 'some-caps', sessionOpts: 'some-opts'},
                sinon.match.instanceOf(Calibrator)
            );
        });

        it('should emit "NEW_BROWSER" event on creating of a browser', async () => {
            const emitter = new EventEmitter();
            const onNewBrowser = sandbox.spy().named('onNewBrowser');
            const browserPool = mkPool_({emitter});

            emitter.on(RunnerEvents.NEW_BROWSER, onNewBrowser);
            Browser.create.returns(mkBrowser_({id: 'bro-id', publicAPI: {some: 'api'}}));

            await browserPool.getBrowser({browserId: 'bro-id', browserVersion: '10.1'});

            assert.calledOnceWith(onNewBrowser, {some: 'api'}, {browserId: 'bro-id', browserVersion: '10.1'});
        });

        describe('getting of browser fails', () => {
            beforeEach(() => {
                sandbox.spy(BasicPool.prototype, 'freeBrowser');
            });

            it('should be rejected if instance of browser was not created', () => {
                Browser.create.throws(new Error('foo bar'));

                return assert.isRejected(mkPool_().getBrowser({}), /foo bar/);
            });

            describe('init fails', () => {
                const mkBrowserRejectsOnInit = (params = {}) => {
                    const browser = mkBrowser_(params);
                    Browser.create.returns(browser);

                    browser.init.rejects();

                    return browser;
                };

                it('should mark browser as broken', async () => {
                    const browser = mkBrowserRejectsOnInit({id: 'bro-id'});

                    await mkPool_().getBrowser({browserId: 'bro-id'}).catch((e) => e);

                    assert.calledOnceWith(browser.markAsBroken);
                });

                it('should extend browser with session id', async () => {
                    const browser = mkBrowserRejectsOnInit({id: 'bro-id'});

                    await mkPool_().getBrowser({browserId: 'bro-id', sessionId: '100500'}).catch((e) => e);

                    assert.equal(browser.sessionId, '100500');
                });

                it('should extend browser with browser version', async () => {
                    const browser = mkBrowserRejectsOnInit({id: 'bro-id', version: '10.1'});

                    await mkPool_()
                        .getBrowser({browserId: 'bro-id', browserVersion: '10.1', sessionId: '100500'})
                        .catch((e) => e);

                    assert.equal(browser.version, '10.1');
                });

                it('should free browser', async () => {
                    const browser = mkBrowserRejectsOnInit({id: 'bro-id'});

                    await mkPool_().getBrowser({browserId: 'bro-id'}).catch((e) => e);

                    assert.calledOnceWith(BasicPool.prototype.freeBrowser, browser);
                });

                it('should free browser after marking browser as broken', async () => {
                    const browser = mkBrowserRejectsOnInit({id: 'bro-id'});

                    await mkPool_().getBrowser({browserId: 'bro-id'}).catch((e) => e);

                    assert.callOrder(browser.markAsBroken, BasicPool.prototype.freeBrowser);
                });

                it('should be rejected with error extended by browser meta', async () => {
                    mkBrowserRejectsOnInit({id: 'bro-id', meta: {foo: 'bar'}});

                    const error = await mkPool_().getBrowser({browserId: 'bro-id'}).catch((e) => e);

                    assert.deepEqual(error.meta, {foo: 'bar'});
                });
            });
        });
    });

    describe('freeBrowser', () => {
        it('should release browser', async () => {
            const browserPool = mkPool_();

            Browser.create.returns(mkBrowser_());

            const browser = await browserPool.getBrowser({browserId: 'bro-id'});
            browserPool.freeBrowser(browser);

            assert.calledOnce(browser.quit);
        });

        it('should send test related freeBrowser event on browser release', async () => {
            mkPool_().freeBrowser(mkBrowser_({sessionId: '100500', state: {foo: 'bar'}}));

            assert.calledOnceWith(ipc.emit, 'worker.100500.freeBrowser', {foo: 'bar'});
        });
    });
});
