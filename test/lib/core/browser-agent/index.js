'use strict';

const Promise = require('bluebird');
const BrowserAgent = require('lib/core/browser-agent');
const BasicPool = require('lib/browser-pool/basic-pool');

describe('browser-agent', () => {
    const sandbox = sinon.sandbox.create();
    let browserPool;

    beforeEach(() => {
        browserPool = sinon.createStubInstance(BasicPool);
        browserPool.freeBrowser.returns(Promise.resolve());
        browserPool.getBrowser.returns(Promise.resolve({}));
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should return browser associated with agent', () => {
        const browserAgent = BrowserAgent.create('browser', browserPool);

        browserPool.getBrowser.withArgs('browser').returns(Promise.resolve({foo: 'bar'}));

        return assert.becomes(browserAgent.getBrowser(), {foo: 'bar'});
    });

    it('should request browser with passed options', async () => {
        const browserAgent = BrowserAgent.create(null, browserPool);

        await browserAgent.getBrowser({some: 'opt'});

        assert.calledOnceWith(browserPool.getBrowser, sinon.match.any, {some: 'opt'});
    });

    it('should rerequest browser if got same session', () => {
        const someBro = {sessionId: 'some-id'};
        const otherBro = {sessionId: 'other-id'};

        browserPool.getBrowser.returns(Promise.resolve(someBro));

        const browserAgent = BrowserAgent.create('bro', browserPool);

        return browserAgent.getBrowser()
            .then((bro) => browserAgent.freeBrowser(bro))
            .then(() => {
                // reset stubs
                browserPool.getBrowser = sandbox.stub();
                browserPool.getBrowser.onFirstCall().returns(Promise.resolve(someBro));
                browserPool.getBrowser.onSecondCall().returns(Promise.resolve(otherBro));

                browserPool.freeBrowser = sandbox.stub().returns(Promise.resolve());
            })
            .then(() => browserAgent.getBrowser())
            .then((bro) => {
                assert.equal(bro, otherBro);
                assert.calledTwice(browserPool.getBrowser);
                assert.calledWith(browserPool.freeBrowser, someBro, {force: true});
            });
    });

    it('should always request browser with passed options', async () => {
        browserPool.getBrowser
            .onCall(0).resolves({sessionId: 'foo'})
            .onCall(1).resolves({sessionId: 'foo'})
            .onCall(2).resolves({sessionId: 'bar'});

        const browserAgent = BrowserAgent.create('bro', browserPool);

        await browserAgent.getBrowser({some: 'opt'});
        await browserAgent.getBrowser({some: 'opt'});

        assert.alwaysCalledWith(browserPool.getBrowser, sinon.match.any, {some: 'opt'});
    });

    it('should free passed browser', () => {
        const browserAgent = BrowserAgent.create(null, browserPool);
        const browser = sinon.spy().named('browser');

        browserPool.freeBrowser.withArgs(browser, {some: 'opts'}).returns(Promise.resolve({freed: 'browser'}));

        assert.becomes(browserAgent.freeBrowser(browser, {some: 'opts'}), {freed: 'browser'});
    });
});
