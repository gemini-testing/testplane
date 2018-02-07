'use strict';

const {Calibrator} = require('gemini-core');
const webdriverio = require('webdriverio');
const Camera = require('lib/browser/camera');
const Browser = require('lib/browser/existing-browser');
const logger = require('lib/utils/logger');
const {mkExistingBrowser_: mkBrowser_, mkSessionStub_} = require('./utils');

describe('NewBrowser', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_(sandbox);
        sandbox.stub(webdriverio, 'remote');
        webdriverio.remote.returns(session);
        sandbox.stub(logger, 'warn');
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
        });

        describe('url decorator', () => {
            it('should force rewrite base `url` method', () => {
                mkBrowser_();

                assert.calledWith(session.addCommand, 'url', sinon.match.func, true);
            });

            it('should call base `url` method', () => {
                const baseUrlFn = session.url;

                mkBrowser_();

                session.url('/foo/bar?baz=qux');

                assert.calledWith(baseUrlFn, 'http://base_url/foo/bar?baz=qux');
                assert.calledOn(baseUrlFn, session);
            });

            it('should add last url to meta-info and replace path if it starts from /', () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org/root'});

                session
                    .url('/some/url')
                    .url('/foo/bar?baz=qux');

                assert.equal(browser.meta.url, 'http://some.domain.org/foo/bar?baz=qux');
            });

            it('should add last url to meta-info if it contains only query part', () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org/root'});

                session.url('?baz=qux');

                assert.equal(browser.meta.url, 'http://some.domain.org/root?baz=qux');
            });

            it('should concat url without slash at the beginning to the base url', () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org'});

                session.url('some/url');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url');
            });

            it('should not remove the last slash from meta url', () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org'});

                session.url('/some/url/');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url/');
            });

            it('should remove consecutive slashes in meta url', () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org/'});

                session.url('/some/url');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url');
            });

            it('should not save any url if `url` called as getter', () => {
                const browser = mkBrowser_();

                session.url();

                assert.notProperty(browser.meta, 'url');
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

        describe('camera calibration', () => {
            let calibrator;

            beforeEach(() => {
                calibrator = sinon.createStubInstance(Calibrator);

                calibrator.calibrate.resolves();

                sandbox.stub(Camera.prototype, 'calibrate');
                sandbox.stub(Camera.prototype, 'isCalibrated');
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

            it('should not perform calibration if camera is already calibrated', () => {
                Camera.prototype.isCalibrated.returns(true);

                return mkBrowser_({calibrate: true})
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
        });

        it('should delegate actual capturing to camera object', () => {
            Camera.prototype.captureViewportImage.resolves({some: 'image'});

            return mkBrowser_().captureViewportImage()
                .then((image) => {
                    assert.calledOnce(Camera.prototype.captureViewportImage);
                    assert.deepEqual(image, {some: 'image'});
                });
        });
    });
});
