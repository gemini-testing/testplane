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
        return _.defaults(opts || {}, {
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
        });
    }

    function makeSessionStub_() {
        const session = q();
        session.init = sandbox.stub().named('init').returns(session);
        session.end = sandbox.stub().named('end').returns(q());
        session.url = sandbox.stub().named('url').returns(session);

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
    });
});
