'use strict';

const _ = require('lodash');
const BaseBrowserAgent = require('gemini-core').BrowserAgent;
const BrowserAgent = require('lib/runner/browser-agent');

describe('runner/browser-agent', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(BaseBrowserAgent, 'create').returns(Object.create(BaseBrowserAgent.prototype));
        sandbox.stub(BaseBrowserAgent.prototype, 'getBrowser');
        sandbox.stub(BaseBrowserAgent.prototype, 'freeBrowser');
    });

    afterEach(() => sandbox.restore());

    it('should call base browser agent "create" with passed args', () => {
        BrowserAgent.create({foo: 'bar'});

        assert.calledOnceWith(BaseBrowserAgent.create, {foo: 'bar'});
    });

    it('should return "browserId" from base browser agent', () => {
        BaseBrowserAgent.create.withArgs('bro-id').returns({browserId: 'bro-id'});
        const browserAgent = BrowserAgent.create('bro-id');

        assert.equal(browserAgent.browserId, 'bro-id');
    });

    describe('getBrowser', () => {
        it('should call base browser agent "getBrowser" with passed args', () => {
            const browserAgent = BrowserAgent.create();

            browserAgent.getBrowser({foo: 'bar'});

            assert.calledOnceWith(BaseBrowserAgent.prototype.getBrowser, {foo: 'bar'});
        });

        it('should return base browser agent "getBrowser" result', () => {
            const browserAgent = BrowserAgent.create();
            BaseBrowserAgent.prototype.getBrowser.returns({foo: 'bar'});

            const result = browserAgent.getBrowser();

            assert.deepEqual(result, {foo: 'bar'});
        });
    });

    describe('freeBrowser', () => {
        const mkBrowser_ = (state = {}) => {
            return _.defaults({state}, {state: {isBroken: false}});
        };

        it('should call base browser agent "freeBrowser" with "force" option', () => {
            const browserAgent = BrowserAgent.create();
            const browser = mkBrowser_({isBroken: true});

            browserAgent.freeBrowser(browser);

            assert.calledOnceWith(BaseBrowserAgent.prototype.freeBrowser, browser, {force: true});
        });

        it('should return base browser agent "freeBrowser" result', () => {
            const browserAgent = BrowserAgent.create();
            BaseBrowserAgent.prototype.freeBrowser.returns({foo: 'bar'});

            const result = browserAgent.freeBrowser(mkBrowser_());

            assert.deepEqual(result, {foo: 'bar'});
        });
    });
});
