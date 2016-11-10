'use strict';

const _ = require('lodash');
const q = require('q');

const BrowserAgent = require('../../lib/browser-agent');
const BrowserPool = require('../../lib/browser-pool');
const RunnerEvents = require('../../lib/constants/runner-events');
const logger = require('../../lib/utils').logger;

describe('BrowserAgent', () => {
    const sandbox = sinon.sandbox.create();

    const mkBrowserStub = (publicAPI, id) => {
        publicAPI = publicAPI || {};

        const browser = {publicAPI};

        if (id) {
            browser.id = id;
        }

        return browser;
    };

    const createBrowserAgent = (opts) => {
        opts = _.defaults(opts || {}, {
            browserId: 'default-bro',
            pool: sinon.createStubInstance(BrowserPool)
        });

        opts.pool.getBrowser.returns(q(mkBrowserStub()));
        opts.pool.freeBrowser.returns(q());

        return BrowserAgent.create(opts.browserId, opts.pool);
    };

    beforeEach(() => sandbox.stub(logger, 'warn'));

    afterEach(() => sandbox.restore());

    describe('getBrowser', () => {
        it('should get browser', () => {
            const browserStub = mkBrowserStub();
            const pool = sinon.createStubInstance(BrowserPool);
            const browserAgent = createBrowserAgent({browserId: 'bro', pool});

            pool.getBrowser.withArgs('bro').returns(q(browserStub));

            return browserAgent.getBrowser()
                .then((browser) => assert.strictEqual(browser, browserStub));
        });

        it('should emit `SESSION_START` event with browser public API', () => {
            const pool = sinon.createStubInstance(BrowserPool);
            const browserAgent = createBrowserAgent({pool});
            const onSessionStart = sinon.spy().named(RunnerEvents.SESSION_START);

            pool.getBrowser.returns(q(mkBrowserStub({foo: 'bar'})));

            browserAgent.on(RunnerEvents.SESSION_START, onSessionStart);

            return browserAgent.getBrowser()
                .then(() => assert.calledWith(onSessionStart, {foo: 'bar'}));
        });

        it('should emit `SESSION_START` event with browser id', () => {
            const pool = sinon.createStubInstance(BrowserPool);
            const browserAgent = createBrowserAgent({pool});
            const onSessionStart = sinon.spy().named(RunnerEvents.SESSION_START);

            pool.getBrowser.returns(q(mkBrowserStub({foo: 'bar'}, 'some-browser')));

            browserAgent.on(RunnerEvents.SESSION_START, onSessionStart);

            return browserAgent.getBrowser()
                .then(() => assert.calledWith(onSessionStart, {foo: 'bar'}, {browserId: 'some-browser'}));
        });

        it('should wait all `SESSION_START` listeners', () => {
            const pool = sinon.createStubInstance(BrowserPool);
            const browserAgent = createBrowserAgent({pool});

            pool.getBrowser.returns(q(mkBrowserStub()));

            browserAgent.on(RunnerEvents.SESSION_START, (browser) => {
                return q.delay(1).then(() => browser.foo = 'bar');
            });

            return browserAgent.getBrowser()
                .then((browser) => assert.deepEqual(browser, {publicAPI: {foo: 'bar'}}));
        });

        describe('`SESSION_START` listener fails', () => {
            it('should be fulfilled', () => {
                const browserAgent = createBrowserAgent();

                browserAgent.on(RunnerEvents.SESSION_START, q.reject);

                assert.isFulfilled(browserAgent.getBrowser());
            });

            it('should log warning with error', () => {
                const browserAgent = createBrowserAgent();

                browserAgent.on(RunnerEvents.SESSION_START, () => q.reject('awesome-error'));

                return browserAgent.getBrowser()
                    .then(() => assert.calledWith(logger.warn, 'awesome-error'));
            });

            it('should log warning with error stack if present', () => {
                const browserAgent = createBrowserAgent();

                browserAgent.on(RunnerEvents.SESSION_START, () => q.reject({stack: 'awesome-error'}));

                return browserAgent.getBrowser()
                    .then(() => assert.calledWith(logger.warn, 'awesome-error'));
            });
        });
    });

    describe('freeBrowser', () => {
        it('should free browser', () => {
            const browserStub = mkBrowserStub();
            const pool = sinon.createStubInstance(BrowserPool);
            const browserAgent = createBrowserAgent({pool});

            return browserAgent.freeBrowser(browserStub)
                .then(() => assert.calledWith(pool.freeBrowser, browserStub));
        });

        it('should resolve nothing', () => {
            const browserAgent = createBrowserAgent();

            return assert.becomes(browserAgent.freeBrowser({}), undefined);
        });

        it('should emit `SESSION_END` event with browser public API', () => {
            const pool = sinon.createStubInstance(BrowserPool);
            const browserAgent = createBrowserAgent({pool});
            const onSessionEnd = sinon.spy().named(RunnerEvents.SESSION_END);

            browserAgent.on(RunnerEvents.SESSION_END, onSessionEnd);

            return browserAgent.freeBrowser(mkBrowserStub({foo: 'bar'}))
                .then(() => assert.calledWith(onSessionEnd, {foo: 'bar'}));
        });

        it('should emit `SESSION_END` event with browser id', () => {
            const pool = sinon.createStubInstance(BrowserPool);
            const browserAgent = createBrowserAgent({pool});
            const onSessionEnd = sinon.spy().named(RunnerEvents.SESSION_END);

            browserAgent.on(RunnerEvents.SESSION_END, onSessionEnd);

            return browserAgent.freeBrowser(mkBrowserStub({foo: 'bar'}, 'some-browser'))
                .then(() => assert.calledWith(onSessionEnd, {foo: 'bar'}, {browserId: 'some-browser'}));
        });

        it('should wait all `SESSION_END` listeners', () => {
            const browserStub = mkBrowserStub();
            const pool = sinon.createStubInstance(BrowserPool);
            const browserAgent = createBrowserAgent({pool});

            browserAgent.on(RunnerEvents.SESSION_END, (browser) => {
                return q.delay(1).then(() => browser.foo = 'bar');
            });

            return browserAgent.freeBrowser(browserStub)
                .then(() => assert.deepEqual(browserStub, {publicAPI: {foo: 'bar'}}));
        });

        describe('`SESSION_END` listener fails', () => {
            it('should be fulfilled', () => {
                const browserAgent = createBrowserAgent();

                browserAgent.on(RunnerEvents.SESSION_END, q.reject);

                assert.isFulfilled(browserAgent.freeBrowser({}));
            });

            it('should log warning with error', () => {
                const browserAgent = createBrowserAgent();

                browserAgent.on(RunnerEvents.SESSION_END, () => q.reject('awesome-error'));

                return browserAgent.freeBrowser({})
                    .then(() => assert.calledWith(logger.warn, 'awesome-error'));
            });

            it('should log warning with error stack if present', () => {
                const browserAgent = createBrowserAgent();

                browserAgent.on(RunnerEvents.SESSION_END, () => q.reject({stack: 'awesome-error'}));

                return browserAgent.freeBrowser({})
                    .then(() => assert.calledWith(logger.warn, 'awesome-error'));
            });
        });
    });
});
