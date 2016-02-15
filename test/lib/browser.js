'use strict';

var q = require('q'),
    webdriverio = require('webdriverio'),
    Browser = require('../../lib/browser'),
    logger = require('../../lib/utils').logger,
    signalHandler = require('../../lib/signal-handler');

describe('Browser', function() {
    var sandbox = sinon.sandbox.create(),
        session;

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
            baseUrl: 'http://base_url'
        };
    }

    function makeSessionStub() {
        var session = q();
        session.init = sandbox.stub().named('init').returns(session);
        session.end = sandbox.stub().named('end').returns(q());
        return session;
    }

    beforeEach(function() {
        session = makeSessionStub();
        sandbox.stub(webdriverio, 'remote');
        sandbox.stub(logger);
        webdriverio.remote.returns(session);
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('init', function() {
        it('should create webdriver.io session with properties from config', function() {
            var config = createBrowserConfig_();

            return new Browser(config, 'browser').init()
                .then(function() {
                    assert.calledWith(webdriverio.remote, {
                        host: 'test_host',
                        port: '4444',
                        path: '/wd/hub',
                        desiredCapabilities: {browserName: 'browser'},
                        waitforTimeout: 100,
                        logLevel: 'verbose',
                        coloredLogs: true,
                        screenshotPath: 'path/to/screenshots',
                        baseUrl: 'http://base_url'
                    });
                });
        });

        it('should initialize webdriver.io session', function() {
            return new Browser(createBrowserConfig_(), 'browser')
                .init()
                .then(function() {
                    assert.called(session.init);
                });
        });

        it('should resolve promise with browser', function() {
            var browser = new Browser(createBrowserConfig_(), 'browser');

            return assert.eventually.equal(browser.init(), browser);
        });
    });

    describe('quit', function() {
        it('should finalize webdriver.io session', function() {
            return new Browser(createBrowserConfig_(), 'browser')
                .init()
                .then(function(browser) {
                    return browser.quit();
                })
                .then(function() {
                    assert.called(session.end);
                });
        });

        it('should finalize session on global exit event', function() {
            new Browser(createBrowserConfig_(), 'browser')
                .init();

            return signalHandler.emitAndWait('exit')
                .then(function() {
                    assert.called(session.end);
                });
        });

        it('should not finalize session if it has not been initialized', function() {
            return new Browser(createBrowserConfig_(), 'browser').quit()
                .then(function() {
                    assert.notCalled(session.end);
                });
        });
    });

    describe('sessionId', function() {
        it('should return session id of initialized webdriver session', function() {
            session.requestHandler = {
                sessionID: 'foo'
            };

            var browser = new Browser(createBrowserConfig_(), 'browser');

            return browser.init()
                .then(function() {
                    assert.equal(browser.sessionId, 'foo');
                });
        });
    });

    describe('error handling', function() {
        it('should warn in case of failed end', function() {
            session.end.returns(q.reject(new Error('failed end')));
            return new Browser(createBrowserConfig_(), 'browser')
                .init()
                .then(function(browser) {
                    return browser.quit();
                })
                .then(function() {
                    assert.called(logger.warn);
                });
        });
    });
});
