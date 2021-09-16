'use strict';

const BrowserAgent = require('lib/worker/runner/browser-agent');
const BrowserPool = require('lib/worker/runner/browser-pool');

describe('worker/browser-agent', () => {
    let browserPool;

    beforeEach(() => browserPool = sinon.createStubInstance(BrowserPool));

    describe('getBrowser', () => {
        it('should get a browser from the pool', () => {
            browserPool.getBrowser.withArgs({
                browserId: 'bro-id',
                browserVersion: null,
                sessionId: '100-500',
                sessionOpts: 'some-opts'
            }).returns({some: 'browser'});
            const browserAgent = BrowserAgent.create('bro-id', null, browserPool);

            const browser = browserAgent.getBrowser({sessionId: '100-500', sessionOpts: 'some-opts'});

            assert.deepEqual(browser, {some: 'browser'});
        });

        it('should get a browser with specific version from the pool', () => {
            browserPool.getBrowser.withArgs({
                browserId: 'bro-id',
                browserVersion: '10.1',
                sessionId: '100-500',
                sessionOpts: 'some-opts'
            }).returns({some: 'browser'});
            const browserAgent = BrowserAgent.create('bro-id', '10.1', browserPool);

            const browser = browserAgent.getBrowser({sessionId: '100-500', sessionOpts: 'some-opts'});

            assert.deepEqual(browser, {some: 'browser'});
        });
    });

    describe('freeBrowser', () => {
        it('should free the browser in the pool', () => {
            BrowserAgent.create(null, null, browserPool).freeBrowser({some: 'browser'});

            assert.calledOnceWith(browserPool.freeBrowser, {some: 'browser'});
        });
    });
});
