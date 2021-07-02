'use strict';

const {EventEmitter} = require('events');
const Promise = require('bluebird');
const {Calibrator, clientBridge, browser: {Camera}} = require('gemini-core');
const webdriverio = require('webdriverio');
const jsdom = require('jsdom-global');
const Browser = require('lib/browser/existing-browser');
const logger = require('lib/utils/logger');
const history = require('lib/browser/history');
const {mkExistingBrowser_: mkBrowser_, mkSessionStub_} = require('./utils');

describe('ExistingBrowser', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_();
        sandbox.stub(webdriverio, 'attach').resolves(session);
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
            it('should extend meta-info with process pid by default', () => {
                const browser = mkBrowser_();

                assert.propertyVal(browser.meta, 'pid', process.pid);
            });

            it('should extend meta-info with browserVersion by default', () => {
                const browser = mkBrowser_({}, 'bro-id', '10.1');

                assert.propertyVal(browser.meta, 'browserVersion', '10.1');
            });

            it('should set meta-info with provided meta option', () => {
                const browser = mkBrowser_({meta: {k1: 'v1'}});

                assert.propertyVal(browser.meta, 'k1', 'v1');
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

            it('should pass to a camera a function for taking of screenshots', async () => {
                session.takeScreenshot.resolves('foo bar');

                await mkBrowser_().init();

                const takeScreenshot = Camera.create.lastCall.args[1];
                await assert.becomes(takeScreenshot(), 'foo bar');
            });
        });
    });

    describe('init', () => {
        it('should attach to browser with detected session environment flags', async () => {
            const desiredCapabilities = {browserName: 'yabro'};
            const detectedSessionEnvFlags = {isW3C: false, isMobile: false};

            await mkBrowser_({desiredCapabilities}).init({
                sessionCaps: {
                    'goog:chromeOptions': {}
                }
            });

            assert.calledOnce(webdriverio.attach);
            assert.calledWithMatch(webdriverio.attach, {...detectedSessionEnvFlags, isChrome: true});
        });

        it('should attach to browser with session environment flags from config', async () => {
            const desiredCapabilities = {browserName: 'yabro'};
            const sessionEnvFlags = {isW3C: true};

            await mkBrowser_({desiredCapabilities, sessionEnvFlags}).init();

            assert.calledOnce(webdriverio.attach);
            assert.calledWithMatch(webdriverio.attach, sessionEnvFlags);
        });

        it('should attach to browser with default http timeout', async () => {
            await mkBrowser_({sessionRequestTimeout: 100500, httpTimeout: 500100}).init();

            assert.calledWithMatch(webdriverio.attach, {connectionRetryTimeout: 500100});
        });

        describe('in order to correctly work with "devtools" protocol', () => {
            it('should attach to browser with "options" property', async () => {
                await mkBrowser_({automationProtocol: 'devtools'}).init();

                assert.calledWithMatch(webdriverio.attach, {
                    options: {automationProtocol: 'devtools'}
                });
            });

            it('should attach to browser with caps merged from browser config and passed as arg', async () => {
                const desiredCapabilities = {browserName: 'yabro'};
                const sessionCaps = {
                    'goog:chromeOptions': {debuggerAddress: 'localhost:12345'}
                };

                await mkBrowser_({desiredCapabilities}).init({sessionCaps});

                assert.calledWithMatch(webdriverio.attach, {
                    capabilities: {...desiredCapabilities, ...sessionCaps}
                });
            });
        });

        describe('in order to correctly connect to remote browser using CDP', () => {
            it('should attach to browser with "requestedCapabilities" property', async () => {
                const desiredCapabilities = {browserName: 'yabro', 'selenoid:options': {}};

                await mkBrowser_({desiredCapabilities}).init();

                assert.calledWithMatch(webdriverio.attach, {requestedCapabilities: desiredCapabilities});
            });
        });

        describe('commands-history', () => {
            beforeEach(() => {
                sandbox.spy(history, 'initCommandHistory');
            });

            it('should NOT init commands-history if it is off', async () => {
                await mkBrowser_({saveHistory: false}).init();

                assert.notCalled(history.initCommandHistory);
            });

            it('should save history of executed commands if it is enabled', async () => {
                await mkBrowser_({saveHistory: true}).init();

                assert.calledOnceWith(history.initCommandHistory, session);
            });
        });

        describe('should create session with extended "browserVersion" in "desiredCapabilities" if', () => {
            it('it is already exists in capabilities', async () => {
                await mkBrowser_(
                    {desiredCapabilities: {browserName: 'browser', browserVersion: '1.0'}},
                    'browser',
                    '2.0'
                ).init();

                assert.calledWithMatch(webdriverio.attach, {
                    capabilities: {browserName: 'browser', browserVersion: '2.0'}
                });
            });

            it('w3c protocol is used', async () => {
                await mkBrowser_(
                    {sessionEnvFlags: {isW3C: true}},
                    'browser',
                    '2.0'
                ).init();

                assert.calledWithMatch(webdriverio.attach, {
                    capabilities: {browserName: 'browser', browserVersion: '2.0'}
                });
            });
        });

        describe('setMeta', () => {
            it('should set value to meta-info', async () => {
                const browser = await mkBrowser_().init();

                assert.calledWith(session.addCommand, 'setMeta');
                assert.calledWith(session.addCommand, 'getMeta');

                session.setMeta('foo', 'bar');

                assert.equal(session.getMeta('foo'), 'bar');
                assert.include(browser.meta, {foo: 'bar'});
            });
        });

        describe('getMeta', () => {
            it('should get all meta if no key provided', async () => {
                await mkBrowser_().init();

                await session.setMeta('foo', 'bar');
                await session.setMeta('baz', 'qux');

                const meta = await session.getMeta();
                assert.include(meta, {foo: 'bar', baz: 'qux'});
            });
        });

        describe('url decorator', () => {
            it('should overwrite base `url` method', async () => {
                await mkBrowser_().init();

                assert.calledWith(session.overwriteCommand, 'url', sinon.match.func);
            });

            it('should call `getUrl` command if url is not passed', async () => {
                const origUrlFn = session.url;
                await mkBrowser_().init();

                await session.url();

                assert.calledOnceWithExactly(session.getUrl);
                assert.notCalled(origUrlFn);
            });

            it('should call original `url` method', async () => {
                const origUrlFn = session.url;
                await mkBrowser_().init();

                await session.url('/foo/bar?baz=qux');

                assert.calledOnceWith(origUrlFn, 'http://base_url/foo/bar?baz=qux');
            });

            it('should add last url to meta-info and replace path if it starts from /', async () => {
                const browser = await mkBrowser_({baseUrl: 'http://some.domain.org/root'}).init();

                await session.url('/some/url');
                await session.url('/foo/bar?baz=qux');

                assert.equal(browser.meta.url, 'http://some.domain.org/foo/bar?baz=qux');
            });

            it('should add last url to meta-info if it contains only query part', async () => {
                const browser = await mkBrowser_({baseUrl: 'http://some.domain.org/root'}).init();

                await session.url('?baz=qux');

                assert.equal(browser.meta.url, 'http://some.domain.org/root?baz=qux');
            });

            it('should concat url without slash at the beginning to the base url', async () => {
                const browser = await mkBrowser_({baseUrl: 'http://some.domain.org'}).init();

                await session.url('some/url');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url');
            });

            it('should not remove the last slash from meta url', async () => {
                const browser = await mkBrowser_({baseUrl: 'http://some.domain.org'}).init();

                await session.url('/some/url/');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url/');
            });

            it('should remove consecutive slashes in meta url', async () => {
                const browser = await mkBrowser_({baseUrl: 'http://some.domain.org/'}).init();

                await session.url('/some/url');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url');
            });

            it('should not save any url if `url` called as getter', async () => {
                const browser = await mkBrowser_().init();

                await session.url();

                assert.notProperty(browser.meta, 'url');
            });

            describe('"urlHttpTimeout" is set', () => {
                let origUrlFn;

                beforeEach(async () => {
                    origUrlFn = session.url;

                    await mkBrowser_({urlHttpTimeout: 100500, httpTimeout: 500100}).init();
                });

                it('should set http timeout for url command before calling it', async () => {
                    await session.url('/some/url');

                    assert.calledWithMatch(session.extendOptions.firstCall, {connectionRetryTimeout: 100500});
                    assert.callOrder(session.extendOptions.withArgs({connectionRetryTimeout: 100500}), origUrlFn);
                });

                it('should restore http timeout after calling the url command', async () => {
                    await session.url('/some/url');

                    assert.calledWithMatch(session.extendOptions.secondCall, {connectionRetryTimeout: 500100});
                    assert.callOrder(origUrlFn, session.extendOptions.withArgs({connectionRetryTimeout: 500100}));
                });
            });

            describe('"urlHttpTimeout" is not set', () => {
                it('should not set and restore http timeout for url command', async () => {
                    await mkBrowser_().init();

                    await session.url();

                    assert.notCalled(session.extendOptions);
                });
            });
        });

        it('should add "assertView" command', async () => {
            await mkBrowser_().init();

            assert.calledWith(session.addCommand, 'assertView');
        });

        describe('"setOrientation" command', () => {
            it('should not overwrite if it does not exist', async () => {
                session.setOrientation = undefined;

                await mkBrowser_().init();

                assert.neverCalledWith(session.overwriteCommand, 'setOrientation');
            });

            it('should overwrite if it exists', async () => {
                await mkBrowser_().init();

                assert.calledWith(session.overwriteCommand, 'setOrientation');
            });
        });

        it('should call prepareBrowser on new browser', async () => {
            const prepareBrowser = sandbox.stub();

            await mkBrowser_({prepareBrowser}).init();

            assert.calledOnceWith(prepareBrowser, session);
        });

        it('should not fail on error in prepareBrowser', async () => {
            const prepareBrowser = sandbox.stub().throws();

            await mkBrowser_({prepareBrowser}).init();

            assert.calledOnce(logger.warn);
        });

        it('should attach a browser to a provided session', async () => {
            const browser = await mkBrowser_().init({sessionId: '100-500'});

            assert.equal(browser.sessionId, '100-500');
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

                assert.notCalled(session.setWindowSize);
            });

            it('should set window size from config', async () => {
                await mkBrowser_({windowSize: {width: 100500, height: 500100}}).init();

                assert.calledOnceWith(session.setWindowSize, 100500, 500100);
            });
        });

        describe('camera calibration', () => {
            let calibrator;

            beforeEach(() => {
                calibrator = sinon.createStubInstance(Calibrator);

                calibrator.calibrate.resolves();

                sandbox.stub(Camera.prototype, 'calibrate');
            });

            it('should perform calibration if `calibrate` is turn on', async () => {
                calibrator.calibrate.withArgs(sinon.match.instanceOf(Browser)).resolves({foo: 'bar'});

                await mkBrowser_({calibrate: true}).init({}, calibrator);

                assert.calledOnceWith(Camera.prototype.calibrate, {foo: 'bar'});
            });

            it('should not perform calibration if `calibrate` is turn off', async () => {
                await mkBrowser_({calibrate: false}).init({}, calibrator);

                assert.notCalled(Camera.prototype.calibrate);
            });

            it('should perform calibration after attaching of a session', async () => {
                await mkBrowser_({calibrate: true}).init({sessionId: '100-500'}, calibrator);

                const browser = calibrator.calibrate.lastCall.args[0];
                assert.equal(browser.sessionId, '100-500');
            });
        });

        it('should build client scripts', async () => {
            const calibrator = sinon.createStubInstance(Calibrator);
            calibrator.calibrate.resolves({foo: 'bar'});

            const browser = await mkBrowser_({calibrate: true}).init({}, calibrator);

            assert.calledOnceWith(clientBridge.build, browser, {calibration: {foo: 'bar'}});
        });
    });

    describe('reinit', () => {
        it('should attach a browser to a provided session', async () => {
            const browser = await mkBrowser_().init();

            await browser.reinit('100-500');

            assert.equal(browser.sessionId, '100-500');
        });

        describe('set browser orientation', () => {
            it('should not set orientation if it is not specified in a config', async () => {
                const browser = await mkBrowser_().init();

                await browser.reinit();

                assert.notCalled(session.setOrientation);
            });

            it('should set orientation again after init', async () => {
                const browser = await mkBrowser_({orientation: 'portrait'}).init();

                await browser.reinit();

                assert.calledTwice(session.setOrientation);
            });

            it('should set orientation on reinit with specified value from config', async () => {
                const browser = await mkBrowser_({orientation: 'portrait'}).init();

                await browser.reinit();

                assert.calledWith(session.setOrientation.secondCall, 'portrait');
            });
        });

        describe('set winidow size', () => {
            it('should not set window size if it is not specified in a config', async () => {
                const browser = await mkBrowser_().init();

                await browser.reinit();

                assert.notCalled(session.setWindowSize);
            });

            it('should set window size again after init', async () => {
                const browser = await mkBrowser_({windowSize: {width: 100500, height: 500100}}).init();

                await browser.reinit();

                assert.calledTwice(session.setWindowSize);
            });

            it('should set window size on reinit with specified values from config', async () => {
                const browser = await mkBrowser_({windowSize: {width: 100500, height: 500100}}).init();

                await browser.reinit();

                assert.calledWith(session.setWindowSize.secondCall, 100500, 500100);
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

        it('should extend options by calibration results', async () => {
            const clientBridge = stubClientBridge_();
            const calibrator = sinon.createStubInstance(Calibrator);
            calibrator.calibrate.resolves({usePixelRatio: false});

            const browser = mkBrowser_({calibrate: true});

            await browser.init({}, calibrator);
            await browser.prepareScreenshot();

            const opts = clientBridge.call.lastCall.args[1][1];
            assert.propertyVal(opts, 'usePixelRatio', false);
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
        it('should open URL', async () => {
            const browser = await mkBrowser_().init();

            await browser.open('some-url');

            assert.calledOnceWith(session.url, 'some-url');
        });
    });

    describe('evalScript', () => {
        it('should execute script with added `return` operator', async () => {
            const browser = await mkBrowser_().init();

            await browser.evalScript('some-script');

            assert.calledOnceWith(session.execute, 'return some-script');
        });

        it('should return the value of the executed script', async () => {
            session.execute.resolves({foo: 'bar'});
            const browser = await mkBrowser_().init();

            const result = await browser.evalScript('some-script');

            assert.deepEqual(result, {foo: 'bar'});
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

    describe('scrollBy', () => {
        let cleanupJsdom;

        beforeEach(() => {
            cleanupJsdom = jsdom();
            global.window.scrollTo = sinon.stub();
            global.document.querySelector = sinon.stub();
        });

        afterEach(() => {
            cleanupJsdom();
        });

        it('should throw error if passed selector is not found', async () => {
            const args = {x: 10, y: 20, selector: '.non-existent'};
            global.document.querySelector.withArgs('.non-existent').returns(null);
            const browser = mkBrowser_();

            await browser.init();
            browser.scrollBy(args);

            try {
                session.execute.lastCall.args[0](args);
            } catch (e) {
                assert.match(e.message, /Scroll screenshot failed with:.*\.non-existent/);
            }
        });

        describe('should scroll page relative to', () => {
            it('passed selector with calculated "x" and "y" coords', async () => {
                const domElem = {
                    scrollLeft: 10,
                    scrollTop: 20,
                    scrollTo: sinon.stub()
                };
                const args = {x: 10, y: 20, selector: '.some-selector'};
                global.document.querySelector.withArgs('.some-selector').returns(domElem);
                const browser = mkBrowser_();

                await browser.init();
                browser.scrollBy(args);
                session.execute.lastCall.args[0](args);

                assert.calledOnceWith(domElem.scrollTo, 20, 40);
            });

            it('window with calculated "x" and "y" coords', async () => {
                global.window.pageXOffset = 10;
                global.window.pageYOffset = 20;
                const args = {x: 10, y: 20};
                const browser = mkBrowser_();

                await browser.init();
                browser.scrollBy(args);
                session.execute.lastCall.args[0](args);

                assert.calledOnceWith(global.window.scrollTo, 20, 40);
            });
        });
    });

    describe('markAsBroken', () => {
        it('should not be marked as broken by default', () => {
            const browser = mkBrowser_();

            assert.equal(browser.state.isBroken, false);
        });

        it('should mark browser as broken', async () => {
            const browser = await mkBrowser_().init();

            browser.markAsBroken();

            assert.equal(browser.state.isBroken, true);
        });

        it('should not stub "deleteSession" command', async () => {
            session.commandList = ['deleteSession'];
            session.deleteSession = () => 'deleted';
            const browser = await mkBrowser_().init();

            browser.markAsBroken();

            assert.equal(session.deleteSession(), 'deleted');
        });

        it('should not stub session properties', async () => {
            session.commandList = ['isProp'];
            session.isProp = true;
            const browser = await mkBrowser_().init();

            browser.markAsBroken();

            assert.isTrue(session.isProp);
        });

        it('should stub session commands', async () => {
            session.commandList = ['foo'];
            session.foo = () => 'foo';
            const browser = await mkBrowser_().init();

            browser.markAsBroken();

            const result = await session.foo();
            assert.isUndefined(result);
        });
    });

    describe('quit', () => {
        it('should overwrite state field', async () => {
            const browser = await mkBrowser_().init();
            const state = browser.state;

            browser.quit();

            assert.notEqual(state, browser.state);
        });

        it('should keep process id in meta', async () => {
            const browser = await mkBrowser_().init();
            const pid = browser.meta.pid;

            browser.quit();

            assert.equal(browser.meta.pid, pid);
        });
    });
});
