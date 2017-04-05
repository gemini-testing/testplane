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
            sessionRequestTimeout: null,
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
        sandbox.stub(session, 'addCommand', (name, command) => {
            session[name] = command;
            sandbox.spy(session, name);
        });

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
                    screenshotOnReject: false,
                    connectionRetryTimeout: 3000,
                    connectionRetryCount: 0,
                    baseUrl: 'http://base_url'
                }));
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

        it('should set empty meta-info by default', () => {
            return mkBrowser_()
                .init()
                .then((browser) => {
                    assert.deepEqual(browser.meta, {});
                });
        });

        it('should set meta-info with provided meta option', () => {
            return mkBrowser_({meta: {k1: 'v1'}})
                .init()
                .then((browser) => {
                    assert.deepEqual(browser.meta, {k1: 'v1'});
                });
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

        it('should set option "screenshotOnReject" to "false" before initializing of a session', () => {
            return mkBrowser_()
                .init()
                .then(() => assert.calledWithMatch(webdriverio.remote, {screenshotOnReject: false}));
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
                .then(() => assert.propertyVal(session.requestHandler.defaultOptions, 'screenshotOnReject', true));
        });

        describe('"extendOptions" command', () => {
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

        describe('screenshotOnReject option', () => {
            it('should support boolean notation', () => {
                return mkBrowser_({screenshotOnReject: false})
                    .init()
                    .then(() => assert.propertyVal(session.requestHandler.defaultOptions, 'screenshotOnReject', false));
            });

            it('should support object notation', () => {
                const browser = mkBrowser_({
                    screenshotOnReject: {
                        httpTimeout: 666
                    }
                });

                return browser
                    .init()
                    .then(() => {
                        assert.deepPropertyVal(session.requestHandler.defaultOptions,
                            'screenshotOnReject.connectionRetryTimeout', 666);
                    });
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

                        assert.calledWith(baseUrlFn, 'http://base_url/foo/bar?baz=qux');
                        assert.calledOn(baseUrlFn, session);
                    });
            });

            it('should add last url to meta-info and replace path if it starts from /', () => {
                return mkBrowser_({baseUrl: 'http://some.domain.org/root'})
                    .init()
                    .then((browser) => {
                        session
                            .url('/some/url')
                            .url('/foo/bar?baz=qux');

                        assert.equal(browser.meta.url, 'http://some.domain.org/foo/bar?baz=qux');
                    });
            });

            it('should add last url to meta-info if it contains only query part', () => {
                return mkBrowser_({baseUrl: 'http://some.domain.org/root'})
                    .init()
                    .then((browser) => {
                        session.url('?baz=qux');

                        assert.equal(browser.meta.url, 'http://some.domain.org/root?baz=qux');
                    });
            });

            it('should concat url without slash at the beginning to the base url', () => {
                return mkBrowser_({baseUrl: 'http://some.domain.org'})
                    .init()
                    .then((browser) => {
                        session.url('some/url');

                        assert.equal(browser.meta.url, 'http://some.domain.org/some/url');
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
