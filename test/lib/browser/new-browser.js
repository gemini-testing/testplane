'use strict';

const q = require('q');
const webdriverio = require('@gemini-testing/webdriverio');
const logger = require('lib/utils/logger');
const signalHandler = require('lib/signal-handler');
const {mkNewBrowser_: mkBrowser_, mkSessionStub_} = require('./utils');

describe('NewBrowser', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_();
        sandbox.stub(webdriverio, 'remote');
        sandbox.stub(logger);
        webdriverio.remote.returns(session);
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create webdriver.io session with properties from browser config', () => {
            return mkBrowser_()
                .init()
                .then(() => assert.calledWith(webdriverio.remote, {
                    host: 'test_host',
                    port: '4444',
                    path: '/wd/hub',
                    desiredCapabilities: {browserName: 'browser', version: '1.0'},
                    waitforTimeout: 100,
                    logLevel: 'verbose',
                    coloredLogs: true,
                    screenshotPath: 'path/to/screenshots',
                    connectionRetryTimeout: 3000,
                    connectionRetryCount: 0,
                    baseUrl: 'http://base_url'
                }));
        });

        it('should create webdriver.io session with passed version in desiredCapabilities', () => {
            return mkBrowser_({}, 'browser', '2.0')
                .init()
                .then(() => assert.calledWithMatch(webdriverio.remote, {
                    desiredCapabilities: {browserName: 'browser', version: '2.0'}
                }));
        });

        describe('extendOptions command', () => {
            it('should add command', () => {
                return mkBrowser_()
                    .init()
                    .then(() => assert.calledWith(session.addCommand, 'extendOptions'));
            });

            it('should add new option to "requestHandler" options', () => {
                return mkBrowser_()
                    .init()
                    .then(() => {
                        session.extendOptions({newOption: 'foo'});
                        assert.propertyVal(session.requestHandler.defaultOptions, 'newOption', 'foo');
                    });
            });
        });
    });

    describe('init', () => {
        it('should initialize webdriver.io session', () => {
            return mkBrowser_()
                .init()
                .then(() => assert.called(session.init));
        });

        it('should resolve promise with browser', () => {
            const browser = mkBrowser_();

            return assert.eventually.equal(browser.init(), browser);
        });

        it('should set custom options before initializing of a session', () => {
            return mkBrowser_()
                .init()
                .then(() => assert.callOrder(session.extendOptions, session.init));
        });

        it('should use session request timeout for initializing of a session', () => {
            return mkBrowser_({sessionRequestTimeout: 100500, httpTimeout: 500100})
                .init()
                .then(() => {
                    assert.calledWithMatch(session.extendOptions.firstCall, {connectionRetryTimeout: 100500});
                });
        });

        it('should use http timeout for initializing of a session if session request timeout not set', () => {
            return mkBrowser_({sessionRequestTimeout: null, httpTimeout: 500100})
                .init()
                .then(() => {
                    assert.calledWithMatch(session.extendOptions.secondCall, {connectionRetryTimeout: 500100});
                });
        });

        it('should reset options to default after initializing of a session', () => {
            return mkBrowser_()
                .init()
                .then(() => assert.callOrder(session.init, session.extendOptions));
        });

        it('should reset http timeout to default after initializing of a session', () => {
            return mkBrowser_({sessionRequestTimeout: 100500, httpTimeout: 500100})
                .init()
                .then(() => {
                    assert.propertyVal(session.requestHandler.defaultOptions, 'connectionRetryTimeout', 500100);
                });
        });

        it('should not set page load timeout if it is not specified in a config', () => {
            return mkBrowser_({pageLoadTimeout: null})
                .init()
                .then(() => assert.notCalled(session.timeouts));
        });

        it('should set page load timeout if it is specified in a config for w3c incompatible browser', () => {
            return mkBrowser_({pageLoadTimeout: 100500, w3cCompatible: false})
                .init()
                .then(() => assert.calledOnceWith(session.timeouts, 'page load', 100500));
        });

        it('should set page load timeout if it is specified in a config for w3c compatible browser', () => {
            return mkBrowser_({pageLoadTimeout: 100500, w3cCompatible: true})
                .init()
                .then(() => assert.calledOnceWith(session.timeouts, {'pageLoad': 100500}));
        });
    });

    describe('reset', () => {
        it('should be fulfilled', () => assert.isFulfilled(mkBrowser_().reset()));
    });

    describe('quit', () => {
        it('should finalize webdriver.io session', () => {
            return mkBrowser_()
                .init()
                .then((browser) => browser.quit())
                .then(() => assert.called(session.end));
        });

        it('should finalize session on global exit event', () => {
            return mkBrowser_()
                .init()
                .then(() => signalHandler.emitAndWait('exit'))
                .then(() => assert.called(session.end));
        });

        it('should set custom options before finalizing of a session', () => {
            return mkBrowser_()
                .init()
                .then((browser) => browser.quit())
                .then(() => assert.callOrder(session.extendOptions, session.end));
        });

        it('should use session quit timeout for finalizing of a session', () => {
            return mkBrowser_({sessionQuitTimeout: 100500, httpTimeout: 500100})
                .init()
                .then((browser) => browser.quit())
                .then(() => {
                    assert.propertyVal(session.requestHandler.defaultOptions, 'connectionRetryTimeout', 100500);
                });
        });
    });

    describe('sessionId', () => {
        it('should return session id of initialized webdriver session', () => {
            session.requestHandler = {
                sessionID: 'foo'
            };

            assert.equal(mkBrowser_().sessionId, 'foo');
        });

        it('should set session id', () => {
            session.requestHandler = {
                sessionID: 'foo'
            };

            const browser = mkBrowser_();

            browser.sessionId = 'bar';

            assert.equal(browser.sessionId, 'bar');
        });
    });

    describe('error handling', () => {
        it('should warn in case of failed end', () => {
            session.end.returns(q.reject(new Error('failed end')));

            return mkBrowser_()
                .init()
                .then((browser) => browser.quit())
                .then(() => assert.called(logger.warn));
        });
    });
});
