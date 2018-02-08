'use strict';

const BrowserAgent = require('lib/worker/runner/browser-agent');
const BrowserPool = require('lib/worker/runner/browser-pool');

describe('worker/browser-agent', () => {
    let browserPool;

    beforeEach(() => browserPool = sinon.createStubInstance(BrowserPool));

    describe('getBrowser', () => {
        it('should get a browser from the pool', () => {
            browserPool.getBrowser.withArgs('bro-id', '100-500').returns({some: 'browser'});

            assert.deepEqual(BrowserAgent.create('bro-id', browserPool).getBrowser('100-500'), {some: 'browser'});
        });
    });

    describe('freeBrowser', () => {
        it('should free the browser in the pool', () => {
            BrowserAgent.create(null, browserPool).freeBrowser({some: 'browser'});

            assert.calledOnceWith(browserPool.freeBrowser, {some: 'browser'});
        });
    });
});
