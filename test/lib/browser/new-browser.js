'use strict';

const q = require('q');
const webdriverio = require('webdriverio');
const logger = require('lib/utils/logger');
const signalHandler = require('lib/signal-handler');
const {mkNewBrowser_: mkBrowser_, mkSessionStub_} = require('./utils');

describe('NewBrowser', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_(sandbox);
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
                    desiredCapabilities: {browserName: 'browser'},
                    waitforTimeout: 100,
                    logLevel: 'verbose',
                    coloredLogs: true,
                    screenshotPath: 'path/to/screenshots',
                    screenshotOnReject: {connectionRetryTimeout: 3000},
                    connectionRetryTimeout: 3000,
                    connectionRetryCount: 0,
                    baseUrl: 'http://base_url'
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

            it('should override "requestHandler" option', () => {
                return mkBrowser_({screenshotOnReject: true})
                    .init()
                    .then(() => {
                        session.extendOptions({screenshotOnReject: false});
                        assert.propertyVal(session.requestHandler.defaultOptions, 'screenshotOnReject', false);
                    });
            });
        });

        describe('windowHandleSize decorator', () => {
            it('should force rewrite base "windowHandleSize" method', () => {
                return mkBrowser_()
                    .init()
                    .then(() => assert.calledWith(session.addCommand, 'windowHandleSize', sinon.match.func, true));
            });

            it('should call base `windowHandleSize` method', () => {
                const baseFn = session.windowHandleSize;

                return mkBrowser_()
                    .init()
                    .then(() => {
                        session.windowHandleSize('some-id');

                        assert.calledWith(baseFn, 'some-id');
                        assert.calledOn(baseFn, session);
                    });
            });

            it('should save origin browser window size if it will be changed', () => {
                session.windowHandleSize.withArgs({width: 10, height: 10}).returns(session);

                return mkBrowser_({windowSize: {width: 5, height: 10}})
                    .init()
                    .then((browser) => {
                        return session
                            .windowHandleSize({width: 10, height: 10})
                            .then(() => assert.deepEqual(browser.changes.originWindowSize, {width: 5, height: 10}));
                    });
            });

            describe('should not mark browser as needed to restore', () => {
                it('by default', () => {
                    return mkBrowser_({windowSize: {width: 5, height: 10}})
                        .init()
                        .then((browser) => assert.isNull(browser.changes.originWindowSize));
                });

                it('if "windowHandleSize" was called as getter', () => {
                    return mkBrowser_()
                        .init()
                        .then((browser) => {
                            session.windowHandleSize();

                            assert.isNull(browser.changes.originWindowSize);
                        });
                });

                it('if "windowHandleSize" was called with session id', () => {
                    return mkBrowser_()
                        .init()
                        .then((browser) => {
                            session.windowHandleSize('session-id');

                            assert.isNull(browser.changes.originWindowSize);
                        });
                });

                it('if "windowHandleSize" was called with the same size as in the config', () => {
                    return mkBrowser_({windowSize: {width: 5, height: 10}})
                        .init()
                        .then((browser) => {
                            session.windowHandleSize({width: 5, height: 10});

                            assert.isNull(browser.changes.originWindowSize);
                        });
                });
            });
        });
    });

    describe('screenshotOnReject option', () => {
        it('should set screenshotOnReject as false if option is disabled', () => {
            return mkBrowser_({screenshotOnReject: false})
                .init()
                .then(() => assert.propertyVal(session.requestHandler.defaultOptions, 'screenshotOnReject', false));
        });

        it('should set screenshotOnReject as object with timeout if option is enabled', () => {
            const browser = mkBrowser_({screenshotOnReject: true, screenshotOnRejectTimeout: 666});

            return browser
                .init()
                .then(() => {
                    assert.equal(session.requestHandler.defaultOptions.screenshotOnReject.connectionRetryTimeout, 666);
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
                    assert.calledWithMatch(session.extendOptions.secondCall, {connectionRetryTimeout: 100500});
                });
        });

        it('should set option "screenshotOnReject" to "false" before initializing of a session', () => {
            return mkBrowser_()
                .init()
                .then(() => assert.calledWithMatch(session.extendOptions.firstCall, {screenshotOnReject: false}));
        });

        it('should set browser window size from config', () => {
            return mkBrowser_({windowSize: {width: 10, height: 20}})
                .init()
                .then(() => {
                    assert.calledWithMatch(session.windowHandleSize.firstCall, {width: 10, height: 20});
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

        it('should set option "screenshotOnReject" after initializing of a session', () => {
            return mkBrowser_({screenshotOnReject: true})
                .init()
                .then(() => assert.isObject(session.requestHandler.defaultOptions.screenshotOnReject));
        });
    });

    describe('reset', () => {
        it('should be fulfilled', () => assert.isFulfilled(mkBrowser_().reset()));

        it('should not reset browser window size if it was not changed', () => {
            return mkBrowser_({windowSize: {width: 10, height: 5}})
                .init()
                .then((browser) => browser.reset())
                .then(() => {
                    // call "windowHandleSize" on init
                    assert.calledOnceWith(session.windowHandleSize, {width: 10, height: 5});
                });
        });

        it('should reset browser window size to value from config if it was changed in test', () => {
            return mkBrowser_({windowSize: {width: 10, height: 5}})
                .init()
                .then((browser) => {
                    session.windowHandleSize({width: 1, height: 1});
                    return browser;
                })
                .then((browser) => browser.reset())
                .then(() => {
                    assert.calledThrice(session.windowHandleSize);
                    assert.calledWithMatch(session.windowHandleSize.firstCall, {width: 10, height: 5});
                    assert.calledWithMatch(session.windowHandleSize.secondCall, {width: 1, height: 1});
                    assert.calledWithMatch(session.windowHandleSize.thirdCall, {width: 10, height: 5});
                });
        });

        it('should reset browser to origin window size if it was changed in test', () => {
            session.windowHandleSize.withArgs().returns(q({value: {width: 5, height: 5}}));

            return mkBrowser_()
                .init()
                .then((browser) => {
                    session.windowHandleSize({width: 1, height: 1});
                    return browser;
                })
                .then((browser) => browser.reset())
                .then(() => {
                    assert.calledThrice(session.windowHandleSize);
                    assert.calledWithMatch(session.windowHandleSize.firstCall, {width: 1, height: 1});
                    assert.calledWithExactly(session.windowHandleSize.secondCall); // getting current browser size
                    assert.calledWithMatch(session.windowHandleSize.thirdCall, {width: 5, height: 5});
                });
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

        it('should not take screenshot if finalizing of a session rejects', () => {
            return mkBrowser_()
                .init()
                .then((browser) => browser.quit())
                .then(() => assert.propertyVal(session.requestHandler.defaultOptions, 'screenshotOnReject', false));
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
