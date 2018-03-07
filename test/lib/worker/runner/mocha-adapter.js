'use strict';

const _ = require('lodash');
const proxyquire = require('proxyquire');
const BrowserAgent = require('gemini-core').BrowserAgent;
const RunnerEvents = require('lib/constants/runner-events');
const Browser = require('lib/browser/existing-browser');
const logger = require('lib/utils/logger');
const MochaStub = require('../../_mocha');

describe('worker/mocha-adapter', () => {
    const sandbox = sinon.sandbox.create();
    let MochaAdapter;

    const mkBrowserStub_ = () => {
        const browser = sinon.createStubInstance(Browser);
        const wdio = {
            screenshot: sinon.stub().named('screenshot').resolves({})
        };

        Object.defineProperty(browser, 'publicAPI', {get: () => wdio});

        return browser;
    };

    const mkMochaAdapter_ = (config) => {
        config = _.defaults(config, {
            patternsOnReject: [],
            screenshotOnReject: true
        });
        const browserAgent = Object.create(BrowserAgent.prototype);
        const mochaAdapter = MochaAdapter.create(browserAgent, config);

        MochaStub.lastInstance.updateSuiteTree((suite) => {
            return suite
                .onFail(({error, test}) => {
                    if (test) {
                        mochaAdapter.emit(RunnerEvents.TEST_FAIL, {err: error});
                    } else {
                        mochaAdapter.emit(RunnerEvents.ERROR, error);
                    }
                });
        });

        return mochaAdapter;
    };

    beforeEach(() => {
        sandbox.stub(BrowserAgent.prototype);
        BrowserAgent.prototype.getBrowser.resolves(mkBrowserStub_());

        MochaAdapter = proxyquire(require.resolve('lib/worker/runner/mocha-adapter'), {
            'mocha': MochaStub
        });

        sandbox.stub(logger);
    });

    afterEach(() => sandbox.restore());

    it('TODO');

    describe('inject contexts', () => {
        it('should extend test with hermione context before run', async () => {
            mkMochaAdapter_();
            const test = new MochaStub.Test();
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            assert.property(test, 'hermioneCtx');
        });
    });

    describe('runInSession', () => {
        it('should return test error on test fail', () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('test fail')));
            });

            return assert.isRejected(mochaAdapter.runInSession(), /test fail/);
        });

        it('should return hook error on afterEach hook fail', () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest()
                    .afterEach(() => Promise.reject(new Error('hook fail')));
            });

            return assert.isRejected(mochaAdapter.runInSession(), /hook fail/);
        });

        it('should return test error if both test and afterEach hook failed', () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('test fail')))
                    .afterEach(() => Promise.reject(new Error('hook fail')));
            });

            return assert.isRejected(mochaAdapter.runInSession(), /test fail/);
        });
    });

    describe('screenshotOnReject', () => {
        let browser;

        beforeEach(() => {
            browser = mkBrowserStub_();
            BrowserAgent.prototype.getBrowser.resolves(browser);
        });

        it('should attach screenshot to error on test fail', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('o.O')));
            });

            browser.publicAPI.screenshot.resolves({value: 'base64img'});

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.propertyVal(err, 'screenshot', 'base64img');
        });

        it('should not attach screenshot if screenshotOnReject is false', async () => {
            const mochaAdapter = mkMochaAdapter_({screenshotOnReject: false});
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('o.O')));
            });

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.notCalled(browser.publicAPI.screenshot);
            assert.notProperty(err, 'screenshot');
        });

        it('should attach screenshot to error on beforeEach hook fail', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeEach(() => Promise.reject(new Error('o.O')))
                    .addTest();
            });

            browser.publicAPI.screenshot.resolves({value: 'base64img'});

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.propertyVal(err, 'screenshot', 'base64img');
        });

        it('should attach screenshot to error on afterEach hook fail', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest()
                    .afterEach(() => Promise.reject(new Error('o.O')));
            });

            browser.publicAPI.screenshot.resolves({value: 'base64img'});

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.propertyVal(err, 'screenshot', 'base64img');
        });

        it('should not take screenshot on afterEach hook fail if beforeEach hook failed', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeEach(() => Promise.reject(new Error('beforeEach fail')))
                    .addTest()
                    .afterEach(() => Promise.reject(new Error('afterEach fail')));
            });

            await assert.isRejected(mochaAdapter.runInSession());

            assert.calledOnce(browser.publicAPI.screenshot);
        });

        it('should not take screenshot on afterEach hook fail if test failed', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('test fail')))
                    .afterEach(() => Promise.reject(new Error('afterEach fail')));
            });

            await assert.isRejected(mochaAdapter.runInSession());

            assert.calledOnce(browser.publicAPI.screenshot);
        });

        it('should not attach screenshot if error already has one', async () => {
            const screenshot = 'screenshotFromGrid';
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(Object.assign(new Error('o.O'), {screenshot})));
            });

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.notCalled(browser.publicAPI.screenshot);
            assert.propertyVal(err, 'screenshot', screenshot);
        });

        it('should ignore screenshot call fail', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('test fail')));
            });

            browser.publicAPI.screenshot.rejects(new Error('screenshot fail'));

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.propertyVal(err, 'message', 'test fail');
            assert.notProperty(err, 'screenshot');
        });

        it('should set timeout if screenshotOnRejectTimeout option is set', async () => {
            const mochaAdapter = mkMochaAdapter_({screenshotOnRejectTimeout: 100500});
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('o.O')));
            });

            await assert.isRejected(mochaAdapter.runInSession());

            assert.calledOnceWith(browser.setHttpTimeout, 100500);
            assert.callOrder(browser.setHttpTimeout, browser.publicAPI.screenshot);
        });

        it('should restore httpTimeout', async () => {
            const mochaAdapter = mkMochaAdapter_({screenshotOnRejectTimeout: 100500});
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('o.O')));
            });

            await assert.isRejected(mochaAdapter.runInSession());

            assert.calledOnce(browser.restoreHttpTimeout);
            assert.callOrder(browser.publicAPI.screenshot, browser.restoreHttpTimeout);
        });

        it('should restore httpTimeout even if screenshot call failed', async () => {
            const mochaAdapter = mkMochaAdapter_({screenshotOnRejectTimeout: 100500});
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('o.O')));
            });

            browser.publicAPI.screenshot.rejects(new Error('screenshot fail'));

            await assert.isRejected(mochaAdapter.runInSession());

            assert.calledOnce(browser.restoreHttpTimeout);
        });
    });
});
