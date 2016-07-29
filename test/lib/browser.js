'use strict';

const q = require('q');
const webdriverio = require('webdriverio');
const Browser = require('../../lib/browser');
const logger = require('../../lib/utils').logger;
const signalHandler = require('../../lib/signal-handler');

describe('Browser', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    function createBrowserConfig_() {
        return {
            grid: 'http://test_host:4444/wd/hub',
            browsers: {
                browser: {
                    desiredCapabilities: {browserName: 'browser'}
                }
            },
            waitTimeout: 100,
            debug: true,
            screenshotPath: 'path/to/screenshots',
            screenshotOnReject: true,
            baseUrl: 'http://base_url'
        };
    }

    function makeSessionStub_() {
        const session = q();
        session.init = sandbox.stub().named('init').returns(session);
        session.end = sandbox.stub().named('end').returns(q());
        return session;
    }

    function mkBrowser_() {
        return new Browser(createBrowserConfig_(), 'browser');
    }

    beforeEach(() => {
        session = makeSessionStub_();
        sandbox.stub(webdriverio, 'remote');
        sandbox.stub(logger);
        webdriverio.remote.returns(session);
    });

    afterEach(() => sandbox.restore());

    describe('init', () => {
        it('should create webdriver.io session with properties from config', () => {
            return mkBrowser_()
                .init()
                .then(() => assert.calledWith(webdriverio.remote, {
                    host: 'test_host',
                    port: '4444',
                    path: '/wd/hub',
                    desiredCapabilities: {browserName: 'browser'},
                    waitforTimeout: 100,
                    logLevel: 'verbose',
                    coloredLogs: true,
                    screenshotPath: 'path/to/screenshots',
                    screenshotOnReject: true,
                    baseUrl: 'http://base_url'
                }));
        });

        it('should initialize webdriver.io session', () => {
            return mkBrowser_()
                .init()
                .then(() => assert.called(session.init));
        });

        it('should resolve promise with browser', () => {
            var browser = mkBrowser_();

            return assert.eventually.equal(browser.init(), browser);
        });
    });

    describe('quit', () => {
        it('should finalize webdriver.io session', () => {
            return mkBrowser_()
                .init()
                .then((browser) => browser.quit())
                .then(() => assert.called(session.end));
        });

        it('should finalize session on global exit event', () => {
            mkBrowser_().init();

            return signalHandler.emitAndWait('exit')
                .then(() => assert.called(session.end));
        });

        it('should not finalize session if it has not been initialized', () => {
            return mkBrowser_()
                .quit()
                .then(() => assert.notCalled(session.end));
        });
    });

    describe('sessionId', () => {
        it('should return session id of initialized webdriver session', () => {
            session.requestHandler = {
                sessionID: 'foo'
            };

            var browser = mkBrowser_();

            return browser.init()
                .then(() => assert.equal(browser.sessionId, 'foo'));
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
