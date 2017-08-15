'use strict';

const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
const Browser = require('../../../lib/browser');
const BrowserPool = require('../../../lib/worker/browser-pool');
const RunnerEvents = require('../../../lib/worker/constants/runner-events');

describe('worker/browser-pool', () => {
    const sandbox = sinon.sandbox.create();

    const createPool = (opts) => {
        opts = _.defaults(opts || {}, {
            config: {},
            emitter: new EventEmitter()
        });

        return BrowserPool.create(opts.config, opts.emitter);
    };

    afterEach(() => sandbox.restore());

    describe('getBrowser', () => {
        beforeEach(() => {
            sandbox.stub(Browser, 'create').returns({});
        });

        it('should create a new browser if there are no free browsers in a cache', () => {
            const browserPool = createPool({config: {some: 'config'}});

            Browser.create.withArgs({some: 'config'}, 'bro-id').returns({browserId: 'bro-id'});

            const browser = browserPool.getBrowser('bro-id', '100-500');

            assert.deepEqual(browser, {browserId: 'bro-id', sessionId: '100-500'});
        });

        it('should emit "NEW_BROWSER" event on creating of a browser', () => {
            const emitter = new EventEmitter();
            const onNewBrowser = sandbox.spy().named('onNewBrowser');
            const browserPool = createPool({emitter});

            emitter.on(RunnerEvents.NEW_BROWSER, onNewBrowser);

            Browser.create.returns({publicAPI: {some: 'api'}});

            browserPool.getBrowser('bro-id');

            assert.calledOnceWith(onNewBrowser, {some: 'api'}, {browserId: 'bro-id'});
        });

        it('should not create a new browser if there is a free browser in a cache', () => {
            const browserPool = createPool();

            const browser = browserPool.getBrowser('bro-id', '100-500');
            browserPool.freeBrowser(browser);

            Browser.create.resetHistory();

            assert.deepEqual(browserPool.getBrowser('bro-id', '500-100'), browser);
            assert.equal(browser.sessionId, '500-100');
            assert.notCalled(Browser.create);
        });

        it('should not emit "NEW_BROWSER" event on getting of a free browser from a cache', () => {
            const emitter = new EventEmitter();
            const onNewBrowser = sandbox.spy().named('onNewBrowser');
            const browserPool = createPool({emitter});

            emitter.on(RunnerEvents.NEW_BROWSER, onNewBrowser);

            const browser = browserPool.getBrowser('bro-id', '100-500');
            browserPool.freeBrowser(browser);

            onNewBrowser.reset();

            browserPool.getBrowser('bro-id');

            assert.notCalled(onNewBrowser);
        });
    });

    describe('freeBrowser', () => {
        it('should set session id to "null"', () => {
            const browserPool = createPool();
            const browser = {sessionId: '100-500'};

            browserPool.freeBrowser(browser);

            assert.isNull(browser.sessionId);
        });
    });
});
