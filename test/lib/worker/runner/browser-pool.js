'use strict';

const EventEmitter = require('events').EventEmitter;
const {Calibrator} = require('gemini-core');
const _ = require('lodash');
const Browser = require('lib/browser/existing-browser');
const BrowserPool = require('lib/worker/runner/browser-pool');
const RunnerEvents = require('lib/worker/constants/runner-events');
const logger = require('lib/utils/logger');

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

        return bro;
    };

    beforeEach(() => {
        sandbox.stub(logger, 'warn');
        sandbox.stub(Browser, 'create');
    });

    afterEach(() => sandbox.restore());

    describe('getBrowser', () => {
        it('should create browser with correct args', async () => {
            const config = stubConfig();
            const emitter = new EventEmitter();
            const browserPool = createPool({config, emitter});
            const browser = stubBrowser({browserId: 'bro-id'});
            Browser.create.withArgs(config, 'bro-id', emitter).returns(browser);

            await browserPool.getBrowser('bro-id');

            assert.calledOnceWith(Browser.create, config, 'bro-id', emitter);
        });

        it('should create a new browser if there are no free browsers in a cache', () => {
            const config = stubConfig();
            const browserPool = createPool({config});
            const browser = stubBrowser({browserId: 'bro-id'});

            Browser.create.withArgs(config, 'bro-id').returns(browser);

            return assert.becomes(browserPool.getBrowser('bro-id'), browser);
        });

        it('should init a new created browser if there are no free browsers in a cache', () => {
            const browser = stubBrowser({browserId: 'bro-id'});

            Browser.create.returns(browser);

            return createPool().getBrowser('bro-id', '100-500')
                .then(() => assert.calledOnceWith(browser.init, '100-500', sinon.match.instanceOf(Calibrator)));
        });

        it('should emit "NEW_BROWSER" event on creating of a browser', () => {
            const emitter = new EventEmitter();
            const onNewBrowser = sandbox.spy().named('onNewBrowser');
            const browserPool = createPool({emitter});

            emitter.on(RunnerEvents.NEW_BROWSER, onNewBrowser);

            Browser.create.returns(stubBrowser({id: 'bro-id', publicAPI: {some: 'api'}}));

            return browserPool.getBrowser()
                .then(() => assert.calledOnceWith(onNewBrowser, {some: 'api'}, {browserId: 'bro-id'}));
        });

        it('should not create a new browser if there is a free browser in a cache', () => {
            const browserPool = createPool();

            Browser.create.returns(stubBrowser());

            return browserPool.getBrowser('bro-id', '100-500')
                .then((browser) => {
                    browserPool.freeBrowser(browser);
                    Browser.create.resetHistory();

                    return browserPool.getBrowser('bro-id', '500-100')
                        .then((anotherBrowser) => {
                            assert.deepEqual(browser, anotherBrowser);
                            assert.notCalled(Browser.create);
                        });
                });
        });

        it('should reinit a given session to a free browser in a cache', () => {
            const browserPool = createPool();

            Browser.create.returns(stubBrowser());

            return browserPool.getBrowser('bro-id', '100-500')
                .then((browser) => {
                    browserPool.freeBrowser(browser);

                    return browserPool.getBrowser('bro-id', '500-100')
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
    });
});
