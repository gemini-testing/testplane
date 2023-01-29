'use strict';

const BrowserAgent = require('lib/runner/browser-agent');
const HighPriorityBrowserAgent = require('lib/runner/test-runner/high-priority-browser-agent');

describe('runner/test-runner/high-priority-browser-agent', () => {
    describe('getBrowser', () => {
        it('should call base browser agent getBrowser with highPriority option', () => {
            const browserAgent = sinon.createStubInstance(BrowserAgent);
            const highPriorityBrowserAgent = HighPriorityBrowserAgent.create(browserAgent);

            highPriorityBrowserAgent.getBrowser();

            assert.calledOnceWith(browserAgent.getBrowser, {highPriority: true});
        });

        it('should return base browser agent getBrowser result', () => {
            const browserAgent = sinon.createStubInstance(BrowserAgent);
            const highPriorityBrowserAgent = HighPriorityBrowserAgent.create(browserAgent);
            browserAgent.getBrowser.returns({foo: 'bar'});

            const result = highPriorityBrowserAgent.getBrowser();

            assert.deepEqual(result, {foo: 'bar'});
        });
    });

    describe('freeBrowser', () => {
        it('should call base browser agent freeBrowser with passed args', () => {
            const browserAgent = sinon.createStubInstance(BrowserAgent);
            const highPriorityBrowserAgent = HighPriorityBrowserAgent.create(browserAgent);

            highPriorityBrowserAgent.freeBrowser({some: 'bro'}, {foo: 'bar'});

            assert.calledOnceWith(browserAgent.freeBrowser, {some: 'bro'}, {foo: 'bar'});
        });

        it('should return base browser agent freeBrowser result', () => {
            const browserAgent = sinon.createStubInstance(BrowserAgent);
            const highPriorityBrowserAgent = HighPriorityBrowserAgent.create(browserAgent);
            browserAgent.freeBrowser.returns({foo: 'bar'});

            const result = highPriorityBrowserAgent.freeBrowser();

            assert.deepEqual(result, {foo: 'bar'});
        });
    });
});
