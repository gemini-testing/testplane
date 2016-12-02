'use strict';

const _ = require('lodash');
const q = require('q');
const webdriverio = require('webdriverio');
const Browser = require('../../lib/browser');
const logger = require('../../lib/utils').logger;
const signalHandler = require('../../lib/signal-handler');

describe('Browser', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    function createBrowserConfig_(opts) {
        const browser = _.defaults(opts || {}, {
            desiredCapabilities: {browserName: 'browser'},
            baseUrl: 'http://base_url',
            gridUrl: 'http://test_host:4444/wd/hub',
            waitTimeout: 100,
            screenshotPath: 'path/to/screenshots',
            screenshotOnReject: true,
            httpTimeout: 3000,
            sessionQuitTimeout: null
        });

        return {
            baseUrl: 'http://main_url',
            gridUrl: 'http://main_host:4444/wd/hub',
            system: {debug: true},
            forBrowser: () => browser
        };
    }

    function makeSessionStub_() {
        const session = q();
        session.init = sandbox.stub().named('init').returns(session);
        session.end = sandbox.stub().named('end').returns(q());
        session.url = sandbox.stub().named('url').returns(session);
        session.requestHandler = {defaultOptions: {}};

        session.addCommand = () => {};
        sandbox.stub(session, 'addCommand', (name, command) => session[name] = command);

        return session;
    }

    function mkBrowser_(opts) {
        return new Browser(createBrowserConfig_(opts), 'browser');
    }

    beforeEach(() => {
        session = makeSessionStub_();
        sandbox.stub(webdriverio, 'remote');
        sandbox.stub(logger);
        webdriverio.remote.returns(session);
    });

    afterEach(() => sandbox.restore());

    describe('init', () => {
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
                    screenshotOnReject: true,
                    connectionRetryTimeout: 3000,
                    connectionRetryCount: 0,
                    baseUrl: 'http://base_url'
                }));
        });

        it('should set screenshotOnReject as "true"', () => {
            const browser = mkBrowser_({screenshotOnReject: true});

            return browser
                .init()
                .then(() => assert.calledWithMatch(webdriverio.remote, {screenshotOnReject: true}));
        });

        it('should set screenshotOnReject as "false"', () => {
            const browser = mkBrowser_({screenshotOnReject: false});

            return browser
                .init()
                .then(() => assert.calledWithMatch(webdriverio.remote, {screenshotOnReject: false}));
        });

        it('should set screenshotOnReject option', () => {
            const browser = mkBrowser_({
                screenshotOnReject: {
                    httpTimeout: 666
                }
            });

            return browser
                .init()
                .then(() => {
                    assert.calledWithMatch(webdriverio.remote, {
                        screenshotOnReject: {
                            connectionRetryTimeout: 666
                        }
                    });
                });
        });

        it('should initialize webdriver.io session', () => {
            return mkBrowser_()
                .init()
                .then(() => assert.called(session.init));
        });

        it('should resolve promise with browser', () => {
            const browser = mkBrowser_();

            return assert.eventually.equal(browser.init(), browser);
        });

        it('should add meta-info access commands', () => {
            return mkBrowser_()
                .init()
                .then((browser) => {
                    assert.calledWith(session.addCommand, 'setMeta');
                    assert.calledWith(session.addCommand, 'getMeta');

                    session.setMeta('foo', 'bar');

                    assert.equal(session.getMeta('foo'), 'bar');
                    assert.deepEqual(browser.meta, {foo: 'bar'});
                });
        });

        describe('session.url decorator', () => {
            it('should force rewrite base `url` method', () => {
                return mkBrowser_()
                    .init()
                    .then(() => assert.calledWith(session.addCommand, 'url', sinon.match.func, true));
            });

            it('should call base `url` method', () => {
                const baseUrlFn = session.url;

                return mkBrowser_()
                    .init()
                    .then(() => {
                        session.url('/foo/bar?baz=qux');

                        assert.calledWith(baseUrlFn, '/foo/bar?baz=qux');
                        assert.calledOn(baseUrlFn, session);
                    });
            });

            it('should add last url to meta-info', () => {
                return mkBrowser_({baseUrl: 'http://some.domain.org/root'})
                    .init()
                    .then((browser) => {
                        session
                            .url('/some/url')
                            .url('/foo/bar?baz=qux');

                        assert.equal(browser.meta.url, 'http://some.domain.org/root/foo/bar?baz=qux');
                    });
            });

            it('should not concat url without slash at the beginning to the base url', () => {
                return mkBrowser_({baseUrl: 'http://some.domain.org'})
                    .init()
                    .then((browser) => {
                        session.url('some/url');

                        assert.equal(browser.meta.url, 'some/url');
                    });
            });

            it('should not remove the last slash from meta url', () => {
                return mkBrowser_({baseUrl: 'http://some.domain.org'})
                    .init()
                    .then((browser) => {
                        session.url('/some/url/');

                        assert.equal(browser.meta.url, 'http://some.domain.org/some/url/');
                    });
            });

            it('should remove consecutive slashes in meta url', () => {
                return mkBrowser_({baseUrl: 'http://some.domain.org/'})
                    .init()
                    .then((browser) => {
                        session.url('/some/url');

                        assert.equal(browser.meta.url, 'http://some.domain.org/some/url');
                    });
            });

            it('should not save any url if `url` called as getter', () => {
                return mkBrowser_()
                    .init()
                    .then((browser) => {
                        session.url();

                        assert.notProperty(browser.meta, 'url');
                    });
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

        it('should not finalize session if it has not been initialized', () => {
            return mkBrowser_()
                .quit()
                .then(() => assert.notCalled(session.end));
        });

        it('should set custom options before finalizing of a session', () => {
            return mkBrowser_()
                .init()
                .then((browser) => {
                    sandbox.spy(session, 'extendOptions');

                    return browser.quit();
                })
                .then(() => assert.callOrder(session.extendOptions, session.end));
        });

        it('should use common http timeout for finalizing of a session', () => {
            return mkBrowser_({httpTimeout: 100500})
                .init()
                .then((browser) => browser.quit())
                .then(() => {
                    assert.propertyVal(session.requestHandler.defaultOptions, 'connectionRetryTimeout', 100500);
                });
        });

        it('should use session quit timeout for finalizing of a session', () => {
            return mkBrowser_({sessionQuitTimeout: 500100})
                .init()
                .then((browser) => browser.quit())
                .then(() => {
                    assert.propertyVal(session.requestHandler.defaultOptions, 'connectionRetryTimeout', 500100);
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

            const browser = mkBrowser_();

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

        it('should handle an error from prepareBrowser', () => {
            const prepareBrowser = sandbox.stub().throws();

            return assert.isRejected(mkBrowser_({prepareBrowser}).init());
        });
    });
});
