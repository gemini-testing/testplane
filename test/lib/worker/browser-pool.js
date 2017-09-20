'use strict';

const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
const Browser = require('../../../lib/browser');
const BrowserPool = require('../../../lib/worker/browser-pool');
const RunnerEvents = require('../../../lib/worker/constants/runner-events');
const logger = require('../../../lib/utils').logger;

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
        return _.defaults(opts || {}, {
            updateChanges: () => {}
        });
    };

    beforeEach(() => {
        sandbox.stub(logger, 'warn');
    });

    afterEach(() => sandbox.restore());

    describe('getBrowser', () => {
        beforeEach(() => {
            sandbox.stub(Browser, 'create').returns({
                updateChanges: () => {}
            });
        });

        it('should create a new browser if there are no free browsers in a cache', () => {
            const config = stubConfig();
            const browserPool = createPool({config});

            Browser.create.withArgs(config, 'bro-id').returns(stubBrowser({browserId: 'bro-id'}));

            const browser = browserPool.getBrowser('bro-id', '100-500');

            assert.propertyVal(browser, 'browserId', 'bro-id');
            assert.propertyVal(browser, 'sessionId', '100-500');
        });

        it('should call prepareBrowser on new browser', () => {
            const prepareBrowser = sinon.stub();
            const config = stubConfig({prepareBrowser});
            const browserPool = createPool({config});
            const bro = stubBrowser({publicAPI: {some: 'api'}});

            Browser.create.returns(bro);

            browserPool.getBrowser();

            assert.calledOnceWith(prepareBrowser, {some: 'api'});
        });

        it('should not fail on error in prepareBrowser', () => {
            const config = stubConfig({prepareBrowser: sinon.stub().throws()});
            const browserPool = createPool({config});
            const bro = stubBrowser({publicAPI: {foo: 'bar'}});

            Browser.create.returns(bro);

            const browser = browserPool.getBrowser();

            assert.equal(browser, bro);
            assert.calledOnce(logger.warn);
        });

        it('should emit "NEW_BROWSER" event on creating of a browser', () => {
            const emitter = new EventEmitter();
            const onNewBrowser = sandbox.spy().named('onNewBrowser');
            const browserPool = createPool({emitter});

            emitter.on(RunnerEvents.NEW_BROWSER, onNewBrowser);

            Browser.create.returns(stubBrowser({id: 'bro-id', publicAPI: {some: 'api'}}));

            browserPool.getBrowser();

            assert.calledOnceWith(onNewBrowser, {some: 'api'}, {browserId: 'bro-id'});
        });

        it('should not fail on error in "NEW_BROWSER" handler', () => {
            const emitter = new EventEmitter();
            const browserPool = createPool({emitter});

            emitter.on(RunnerEvents.NEW_BROWSER, sinon.stub().throws());

            const bro = stubBrowser({id: 'bro-id', publicAPI: {some: 'api'}});
            Browser.create.returns(bro);

            const browser = browserPool.getBrowser();

            assert.equal(browser, bro);
            assert.calledOnce(logger.warn);
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
