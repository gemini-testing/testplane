'use strict';

const Promise = require('bluebird');
const {Calibrator, clientBridge, browser: {Camera}} = require('gemini-core');
const webdriverio = require('@gemini-testing/webdriverio');
const Browser = require('lib/browser/existing-browser');
const logger = require('lib/utils/logger');
const {mkExistingBrowser_: mkBrowser_, mkSessionStub_} = require('./utils');

describe('ExistingBrowser', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_();
        sandbox.stub(webdriverio, 'remote');
        webdriverio.remote.returns(session);
        sandbox.stub(logger, 'warn');
        sandbox.stub(clientBridge, 'build').resolves();
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        describe('meta-info access commands', () => {
            it('should add meta-info access commands', () => {
                const browser = mkBrowser_();

                assert.calledWith(session.addCommand, 'setMeta');
                assert.calledWith(session.addCommand, 'getMeta');

                session.setMeta('foo', 'bar');

                assert.equal(session.getMeta('foo'), 'bar');
                assert.deepEqual(browser.meta, {foo: 'bar'});
            });

            it('should set empty meta-info by default', () => {
                const browser = mkBrowser_();

                assert.deepEqual(browser.meta, {});
            });

            it('should set meta-info with provided meta option', () => {
                const browser = mkBrowser_({meta: {k1: 'v1'}});

                assert.deepEqual(browser.meta, {k1: 'v1'});
            });

            describe('getMeta', () => {
                it('should get all meta if no key provided', async () => {
                    mkBrowser_();

                    await session.setMeta('foo', 'bar');
                    await session.setMeta('baz', 'qux');

                    const meta = await session.getMeta();

                    assert.deepEqual(meta, {foo: 'bar', baz: 'qux'});
                });
            });
        });

        describe('url decorator', () => {
            it('should force rewrite base `url` method', () => {
                mkBrowser_();

                assert.calledWith(session.addCommand, 'url', sinon.match.func, true);
            });

            it('should call base `url` method', async () => {
                const baseUrlFn = session.url;

                mkBrowser_();

                await session.url('/foo/bar?baz=qux');

                assert.calledWith(baseUrlFn, 'http://base_url/foo/bar?baz=qux');
                assert.calledOn(baseUrlFn, session);
            });

            it('should move cursor to position "0,0"', async () => {
                mkBrowser_();

                await session.url('/some/url');

                assert.calledOnceWith(session.moveToObject, 'body', 0, 0);
            });

            it('should disable deprecation warnings before cursor moving', async () => {
                session = mkSessionStub_({deprecationWarnings: true});
                webdriverio.remote.returns(session);

                mkBrowser_();

                let deprecationWarnings;
                session.moveToObject.callsFake(() => deprecationWarnings = session.options.deprecationWarnings);

                await session.url('/some/url');

                assert.isFalse(deprecationWarnings);
            });

            describe('should restore deprecation warnings', () => {
                it('after cursor moving', async () => {
                    session = mkSessionStub_({deprecationWarnings: true});
                    webdriverio.remote.returns(session);

                    mkBrowser_();

                    await session.url('/some/url');

                    assert.isTrue(session.options.deprecationWarnings);
                });

                it('if cursor moving is failed', async () => {
                    session = mkSessionStub_({deprecationWarnings: true});
                    webdriverio.remote.returns(session);

                    session.moveToObject.rejects(new Error());

                    mkBrowser_();

                    await session.url('/some/url').catch(() => {});

                    assert.isTrue(session.options.deprecationWarnings);
                });
            });

            it('should add last url to meta-info and replace path if it starts from /', async () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org/root'});

                await session.url('/some/url');
                await session.url('/foo/bar?baz=qux');

                assert.equal(browser.meta.url, 'http://some.domain.org/foo/bar?baz=qux');
            });

            it('should add last url to meta-info if it contains only query part', async () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org/root'});

                await session.url('?baz=qux');

                assert.equal(browser.meta.url, 'http://some.domain.org/root?baz=qux');
            });

            it('should concat url without slash at the beginning to the base url', async () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org'});

                await session.url('some/url');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url');
            });

            it('should not remove the last slash from meta url', async () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org'});

                await session.url('/some/url/');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url/');
            });

            it('should remove consecutive slashes in meta url', async () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org/'});

                await session.url('/some/url');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url');
            });

            it('should not save any url if `url` called as getter', async () => {
                const browser = mkBrowser_();

                await session.url();

                assert.notProperty(browser.meta, 'url');
            });
        });

        describe('Camera', () => {
            beforeEach(() => {
                sandbox.spy(Camera, 'create');
            });

            it('should create a camera instance', () => {
                mkBrowser_({screenshotMode: 'foo bar'});

                assert.calledOnceWith(Camera.create, 'foo bar');
            });

            it('should pass to a camera a function for taking of screenshots', () => {
                session.screenshot.resolves({value: 'foo bar'});

                mkBrowser_();

                const takeScreenshot = Camera.create.lastCall.args[1];

                return assert.becomes(takeScreenshot(), 'foo bar');
            });
        });

        it('should add "assertView" command', () => {
            mkBrowser_();

            assert.calledWith(session.addCommand, 'assertView');
        });
    });

    describe('init', () => {
        it('should call prepareBrowser on new browser', () => {
            const prepareBrowser = sandbox.stub();

            return mkBrowser_({prepareBrowser})
                .init()
                .then(() => assert.calledOnceWith(prepareBrowser, session));
        });

        it('should not fail on error in prepareBrowser', () => {
            const prepareBrowser = sandbox.stub().throws();

            return mkBrowser_({prepareBrowser})
                .init()
                .then(() => assert.calledOnce(logger.warn));
        });

        it('should attach a browser to a provided session', () => {
            const browser = mkBrowser_();

            return browser.init('100-500')
                .then(() => assert.equal(browser.sessionId, '100-500'));
        });

        describe('set browser orientation', () => {
            it('should not set orientation if it is not specified in config', async () => {
                await mkBrowser_().init();

                assert.notCalled(session.setOrientation);
            });

            it('should set orientation that specified in config', async () => {
                await mkBrowser_({orientation: 'portrait'}).init();

                assert.calledOnceWith(session.setOrientation, 'portrait');
            });
        });

        describe('camera calibration', () => {
            let calibrator;

            beforeEach(() => {
                calibrator = sinon.createStubInstance(Calibrator);

                calibrator.calibrate.resolves();

                sandbox.stub(Camera.prototype, 'calibrate');
            });

            it('should perform calibration if `calibrate` is turn on', () => {
                calibrator.calibrate.withArgs(sinon.match.instanceOf(Browser)).resolves({foo: 'bar'});

                return mkBrowser_({calibrate: true})
                    .init(null, calibrator)
                    .then(() => assert.calledOnceWith(Camera.prototype.calibrate, {foo: 'bar'}));
            });

            it('should not perform calibration if `calibrate` is turn off', () => {
                return mkBrowser_({calibrate: false})
                    .init(null, calibrator)
                    .then(() => {
                        assert.notCalled(Camera.prototype.calibrate);
                    });
            });

            it('should perform calibration after attaching of a session id', () => {
                sandbox.spy(Browser.prototype, 'attach');

                return mkBrowser_({calibrate: true})
                    .init(null, calibrator)
                    .then(() => assert.callOrder(Browser.prototype.attach, calibrator.calibrate));
            });
        });

        it('should build client scripts', () => {
            const calibrator = sinon.createStubInstance(Calibrator);
            calibrator.calibrate.resolves({foo: 'bar'});

            const browser = mkBrowser_({calibrate: true});

            return browser.init(null, calibrator)
                .then(() => assert.calledOnceWith(clientBridge.build, browser, {calibration: {foo: 'bar'}}));
        });
    });

    describe('prepareScreenshot', () => {
        const stubClientBridge_ = () => {
            const bridge = {call: sandbox.stub().resolves()};

            clientBridge.build.resolves(bridge);

            return bridge;
        };

        it('should prepare screenshot', () => {
            const clientBridge = stubClientBridge_();

            clientBridge.call.withArgs('prepareScreenshot').resolves({foo: 'bar'});

            const browser = mkBrowser_();

            return browser.init()
                .then(() => assert.becomes(browser.prepareScreenshot(), {foo: 'bar'}));
        });

        it('should prepare screenshot for passed selectors', () => {
            const clientBridge = stubClientBridge_();
            const browser = mkBrowser_();

            return browser.init()
                .then(() => browser.prepareScreenshot(['.foo', '.bar']))
                .then(() => {
                    const selectors = clientBridge.call.lastCall.args[1][0];

                    assert.deepEqual(selectors, ['.foo', '.bar']);
                });
        });

        it('should prepare screenshot using passed options', () => {
            const clientBridge = stubClientBridge_();
            const browser = mkBrowser_();

            return browser.init()
                .then(() => browser.prepareScreenshot([], {foo: 'bar'}))
                .then(() => {
                    const opts = clientBridge.call.lastCall.args[1][1];

                    assert.propertyVal(opts, 'foo', 'bar');
                });
        });

        it('should extend options by calibration results', () => {
            const clientBridge = stubClientBridge_();
            const calibrator = sinon.createStubInstance(Calibrator);
            calibrator.calibrate.resolves({usePixelRatio: false});

            const browser = mkBrowser_({calibrate: true});

            return browser.init(null, calibrator)
                .then(() => browser.prepareScreenshot())
                .then(() => {
                    const opts = clientBridge.call.lastCall.args[1][1];

                    assert.propertyVal(opts, 'usePixelRatio', false);
                });
        });

        it('should use pixel ratio by default if calibration was not met', () => {
            const clientBridge = stubClientBridge_();
            const browser = mkBrowser_({calibrate: false});

            return browser.init()
                .then(() => browser.prepareScreenshot())
                .then(() => {
                    const opts = clientBridge.call.lastCall.args[1][1];

                    assert.propertyVal(opts, 'usePixelRatio', true);
                });
        });
    });

    describe('open', () => {
        it('should open URL', () => {
            return mkBrowser_().open('some-url')
                .then(() => assert.calledOnceWith(session.url, 'some-url'));
        });
    });

    describe('evalScript', () => {
        it('should execute script with added `return` operator', () => {
            return mkBrowser_().evalScript('some-script')
                .then(() => assert.calledOnceWith(session.execute, 'return some-script'));
        });

        it('should return the value of the executed script', () => {
            session.execute.resolves({value: {foo: 'bar'}});

            return assert.becomes(mkBrowser_().evalScript('some-script'), {foo: 'bar'});
        });
    });

    describe('captureViewportImage', () => {
        beforeEach(() => {
            sandbox.stub(Camera.prototype, 'captureViewportImage');
            sandbox.stub(Promise, 'delay').returns(Promise.resolve());
        });

        it('should delay capturing by the configured amount of time', () => {
            Camera.prototype.captureViewportImage.withArgs({foo: 'bar'}).resolves({some: 'image'});

            return mkBrowser_({screenshotDelay: 100500}).captureViewportImage({foo: 'bar'})
                .then(() => {
                    assert.calledOnceWith(Promise.delay, 100500);
                    assert.callOrder(Promise.delay, Camera.prototype.captureViewportImage);
                });
        });

        it('should delegate actual capturing to camera object', () => {
            Camera.prototype.captureViewportImage.withArgs({foo: 'bar'}).resolves({some: 'image'});

            return mkBrowser_().captureViewportImage({foo: 'bar'})
                .then((image) => assert.deepEqual(image, {some: 'image'}));
        });
    });
});
