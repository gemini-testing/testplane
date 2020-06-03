'use strict';

const {EventEmitter} = require('events');
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
        it('should set emitter', () => {
            const emitter = new EventEmitter();

            const browser = mkBrowser_({}, 'bro', null, emitter);

            assert.deepEqual(browser.emitter, emitter);
        });

        describe('meta-info access commands', () => {
            it('should set meta-info with process pid by default', () => {
                const browser = mkBrowser_();

                assert.deepEqual(browser.meta, {pid: process.pid});
            });

            it('should add meta-info access commands', () => {
                const browser = mkBrowser_();

                assert.calledWith(session.addCommand, 'setMeta');
                assert.calledWith(session.addCommand, 'getMeta');

                session.setMeta('foo', 'bar');

                assert.equal(session.getMeta('foo'), 'bar');
                assert.include(browser.meta, {foo: 'bar'});
            });

            it('should set meta-info with provided meta option', () => {
                const browser = mkBrowser_({meta: {k1: 'v1'}});

                assert.propertyVal(browser.meta, 'k1', 'v1');
            });

            describe('getMeta', () => {
                it('should get all meta if no key provided', async () => {
                    mkBrowser_();

                    await session.setMeta('foo', 'bar');
                    await session.setMeta('baz', 'qux');

                    const meta = await session.getMeta();

                    assert.include(meta, {foo: 'bar', baz: 'qux'});
                });
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

                session.url('/some/url');
                session.url('/foo/bar?baz=qux');

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
            it('should not set orientation if it is not specified in a config', async () => {
                await mkBrowser_().init();

                assert.notCalled(session.setOrientation);
            });

            it('should set orientation which is specified in a config', async () => {
                await mkBrowser_({orientation: 'portrait'}).init();

                assert.calledOnceWith(session.setOrientation, 'portrait');
            });
        });

        describe('set winidow size', () => {
            it('should not set window size if it is not specified in a config', async () => {
                await mkBrowser_().init();

                assert.notCalled(session.windowHandleSize);
            });

            it('should set window size from config', async () => {
                await mkBrowser_({windowSize: {width: 100500, height: 500100}}).init();

                assert.calledOnceWith(session.windowHandleSize, {width: 100500, height: 500100});
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
                return mkBrowser_({calibrate: true})
                    .init('100-500', calibrator)
                    .then(() => {
                        const browser = calibrator.calibrate.lastCall.args[0];
                        assert.equal(browser.sessionId, '100-500');
                    });
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

    describe('reinit', () => {
        it('should attach a browser to a provided session', () => {
            const browser = mkBrowser_();

            return browser.reinit('100-500')
                .then(() => assert.equal(browser.sessionId, '100-500'));
        });

        describe('set browser orientation', () => {
            it('should not set orientation if it is not specified in a config', async () => {
                await mkBrowser_().reinit();

                assert.notCalled(session.setOrientation);
            });

            it('should set orientation which is specified in a config', async () => {
                await mkBrowser_({orientation: 'portrait'}).reinit();

                assert.calledOnceWith(session.setOrientation, 'portrait');
            });

            it('should set orientation again after init', async () => {
                const browser = mkBrowser_({orientation: 'portrait'});
                await browser.init();

                await browser.reinit();

                assert.calledTwice(session.setOrientation);
            });
        });

        describe('set winidow size', () => {
            it('should not set window size if it is not specified in a config', async () => {
                await mkBrowser_().reinit();

                assert.notCalled(session.windowHandleSize);
            });

            it('should set window size from config', async () => {
                await mkBrowser_({windowSize: {width: 100500, height: 500100}}).reinit();

                assert.calledOnceWith(session.windowHandleSize, {width: 100500, height: 500100});
            });

            it('should set window size again after init', async () => {
                const browser = mkBrowser_({windowSize: {width: 100500, height: 500100}});
                await browser.init();

                await browser.reinit();

                assert.calledTwice(session.windowHandleSize);
            });
        });
    });

    describe('prepareScreenshot', () => {
        const stubClientBridge_ = () => {
            const bridge = {call: sandbox.stub().resolves({})};

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

        it('should throw error from browser', async () => {
            const clientBridge = stubClientBridge_();
            clientBridge.call.withArgs('prepareScreenshot').resolves({error: 'JS', message: 'stub error'});

            const browser = mkBrowser_();
            await browser.init();

            await assert.isRejected(browser.prepareScreenshot(), 'Prepare screenshot failed with error type \'JS\' and error message: stub error');
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

        it('should delay capturing on the passed time', () => {
            Camera.prototype.captureViewportImage.withArgs({foo: 'bar'}).resolves({some: 'image'});

            return mkBrowser_({screenshotDelay: 100500}).captureViewportImage({foo: 'bar'}, 2000)
                .then(() => {
                    assert.calledOnceWith(Promise.delay, 2000);
                    assert.callOrder(Promise.delay, Camera.prototype.captureViewportImage);
                });
        });

        it('should delegate actual capturing to camera object', () => {
            Camera.prototype.captureViewportImage.withArgs({foo: 'bar'}).resolves({some: 'image'});

            return mkBrowser_().captureViewportImage({foo: 'bar'})
                .then((image) => assert.deepEqual(image, {some: 'image'}));
        });
    });

    describe('markAsBroken', () => {
        it('should not be marked as broken by default', () => {
            const browser = mkBrowser_();

            assert.equal(browser.state.isBroken, false);
        });

        it('should mark browser as broken', () => {
            const browser = mkBrowser_();

            browser.markAsBroken();

            assert.equal(browser.state.isBroken, true);
        });

        ['addCommand', 'end', 'session'].forEach((commandName) => {
            it(`should not stub "${commandName}" session command`, () => {
                session[commandName] = () => commandName;

                mkBrowser_().markAsBroken();

                assert.equal(session[commandName](), commandName);
            });
        });

        it('should stub session commands', async () => {
            session.foo = () => 'foo';

            mkBrowser_().markAsBroken();

            const result = await session.foo();
            assert.isUndefined(result);
        });
    });

    describe('quit', () => {
        it('should overwrite state field', () => {
            const browser = mkBrowser_();
            const state = browser.state;

            browser.quit();

            assert.notEqual(state, browser.state);
        });

        it('should keep process id in meta', () => {
            const browser = mkBrowser_();
            const pid = browser.meta.pid;

            browser.quit();

            assert.equal(browser.meta.pid, pid);
        });

        it('should clear command history', () => {
            const browser = mkBrowser_();
            session.commandList = [{name: 'foo', args: ['bar'], stack: 'file', result: {}, timestamp: 100500}];

            browser.quit();

            assert.lengthOf(session.commandList, 0, 'command history is empty');
        });
    });
});
