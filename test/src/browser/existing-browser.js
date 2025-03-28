"use strict";

const { EventEmitter } = require("events");
const crypto = require("crypto");
const _ = require("lodash");
const jsdom = require("jsdom-global");
const { Calibrator } = require("src/browser/calibrator");
const { Camera } = require("src/browser/camera");
const history = require("src/browser/history");
const {
    SAVE_HISTORY_MODE,
    WEBDRIVER_PROTOCOL,
    DEVTOOLS_PROTOCOL,
    NODEJS_TEST_RUN_ENV,
    BROWSER_TEST_RUN_ENV,
} = require("src/constants/config");
const { MIN_CHROME_VERSION_SUPPORT_ISOLATION, X_REQUEST_ID_DELIMITER } = require("src/constants/browser");
const {
    mkExistingBrowser_,
    mkSessionStub_,
    mkCDPStub_,
    mkCDPBrowserCtx_,
    mkCDPPage_,
    mkCDPTarget_,
} = require("./utils");
const proxyquire = require("proxyquire");

describe("ExistingBrowser", () => {
    const sandbox = sinon.createSandbox();
    let session;
    let ExistingBrowser;
    let webdriverioAttachStub, clientBridgeBuildStub, loggerWarnStub, initCommandHistoryStub, runGroupStub;

    const mkBrowser_ = (configOpts, opts) => {
        return mkExistingBrowser_(configOpts, opts, ExistingBrowser);
    };

    const initBrowser_ = (browser = mkBrowser_(), sessionData = {}, calibrator) => {
        sessionData = _.defaults(sessionData, {
            sessionOpts: {},
            sessionCaps: {},
        });

        return browser.init(sessionData, calibrator);
    };

    const stubClientBridge_ = () => {
        const bridge = { call: sandbox.stub().resolves({}) };

        clientBridgeBuildStub.resolves(bridge);

        return bridge;
    };

    beforeEach(() => {
        session = mkSessionStub_();
        webdriverioAttachStub = sandbox.stub().resolves(session);
        clientBridgeBuildStub = sandbox.stub().resolves();
        loggerWarnStub = sandbox.stub();
        initCommandHistoryStub = sandbox.stub();
        runGroupStub = sandbox.stub();

        ExistingBrowser = proxyquire("src/browser/existing-browser", {
            "@testplane/webdriverio": {
                attach: webdriverioAttachStub,
            },
            "./client-bridge": {
                build: clientBridgeBuildStub,
            },
            "../utils/logger": {
                warn: loggerWarnStub,
            },
            "./browser": proxyquire("src/browser/browser", {
                "./history": {
                    initCommandHistory: initCommandHistoryStub.callsFake(history.initCommandHistory),
                    runGroup: runGroupStub.callsFake(history.runGroup),
                },
            }),
            "./history": {
                runGroup: runGroupStub.callsFake(history.runGroup),
            },
        }).ExistingBrowser;
    });

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        it("should set emitter", () => {
            const emitter = new EventEmitter();

            const browser = mkBrowser_({}, { emitter });

            assert.deepEqual(browser.emitter, emitter);
        });

        describe("meta-info access commands", () => {
            it("should extend meta-info with process pid by default", () => {
                const browser = mkBrowser_();

                assert.propertyVal(browser.meta, "pid", process.pid);
            });

            it("should extend meta-info with browserVersion by default", () => {
                const browser = mkBrowser_({}, { id: "bro-id", version: "10.1" });

                assert.propertyVal(browser.meta, "browserVersion", "10.1");
            });

            it("should set meta-info with provided meta option", () => {
                const browser = mkBrowser_({ meta: { k1: "v1" } });

                assert.propertyVal(browser.meta, "k1", "v1");
            });

            it('should extend meta-info with "testXReqId" field', () => {
                const browser = mkBrowser_({}, { state: { testXReqId: "12345" } });

                assert.propertyVal(browser.meta, "testXReqId", "12345");
            });
        });

        describe("Camera", () => {
            beforeEach(() => {
                sandbox.spy(Camera, "create");
            });

            it("should create a camera instance", () => {
                mkBrowser_({ screenshotMode: "foo bar" });

                assert.calledOnceWith(Camera.create, "foo bar");
            });

            it("should pass to a camera a function for taking of screenshots", async () => {
                session.takeScreenshot.resolves("foo bar");

                await initBrowser_();

                const takeScreenshot = Camera.create.lastCall.args[1];
                await assert.becomes(takeScreenshot(), "foo bar");
            });
        });
    });

    describe("init", () => {
        it("should attach to browser with detected session environment flags", async () => {
            const desiredCapabilities = { browserName: "yabro" };
            const detectedSessionEnvFlags = { isW3C: false, isMobile: false };
            const browser = mkBrowser_({ desiredCapabilities });

            await initBrowser_(browser, {
                sessionCaps: {
                    "goog:chromeOptions": {},
                },
            });

            assert.calledOnce(webdriverioAttachStub);
            assert.calledWithMatch(webdriverioAttachStub, { ...detectedSessionEnvFlags, isChrome: false });
        });

        it("should attach to browser with session environment flags from config", async () => {
            const desiredCapabilities = { browserName: "yabro" };
            const sessionEnvFlags = { isW3C: true };
            const browser = mkBrowser_({ desiredCapabilities, sessionEnvFlags });

            await initBrowser_(browser);

            assert.calledOnce(webdriverioAttachStub);
            assert.calledWithMatch(webdriverioAttachStub, sessionEnvFlags);
        });

        it("should attach to browser with options from master session", async () => {
            const sessionOpts = { foo: "bar" };

            await initBrowser_(mkBrowser_(), { sessionOpts });

            assert.calledWithMatch(webdriverioAttachStub, { ...sessionOpts, options: sessionOpts });
        });

        describe("collect custom command", () => {
            it("should return an empty empty list in nodejs environment", async () => {
                const browser = mkBrowser_({
                    system: {
                        testRunEnv: NODEJS_TEST_RUN_ENV,
                    },
                });

                await initBrowser_(browser);
                session.addCommand("foo", () => {});

                assert.deepEqual(browser.customCommands, []);
            });

            it("should return all custom commands in browser environment", async () => {
                const browser = mkBrowser_({
                    system: {
                        testRunEnv: BROWSER_TEST_RUN_ENV,
                    },
                });

                await initBrowser_(browser);
                session.addCommand("foo", () => {}, false);
                session.addCommand("foo", () => {}, true);

                assert.isNotEmpty(browser.customCommands);
                assert.deepInclude(browser.customCommands, { name: "foo", elementScope: false });
                assert.deepInclude(browser.customCommands, { name: "foo", elementScope: true });
            });
        });

        describe("transformRequest option", () => {
            beforeEach(() => {
                sandbox.stub(crypto, "randomUUID").returns("00000");
            });

            it("should call user handler from config", async () => {
                const request = { headers: {} };
                const transformRequestStub = sinon.stub().returns(request);

                await initBrowser_(mkBrowser_({ transformRequest: transformRequestStub }));

                const { transformRequest } = webdriverioAttachStub.lastCall.args[0];
                transformRequest(request);

                assert.calledOnceWith(transformRequestStub, request);
            });

            it('should not add "X-Request-ID" header if it is already add by user', async () => {
                const request = { headers: {} };
                const transformRequestStub = req => {
                    req.headers["X-Request-ID"] = "100500";
                    return req;
                };

                await initBrowser_(mkBrowser_({ transformRequest: transformRequestStub }));

                const { transformRequest } = webdriverioAttachStub.lastCall.args[0];
                transformRequest(request);

                assert.equal(request.headers["X-Request-ID"], "100500");
            });

            it('should add "X-Request-ID" header', async () => {
                crypto.randomUUID.returns("67890");
                const state = { testXReqId: "12345" };
                const request = { headers: {} };

                await initBrowser_(mkBrowser_({}, { state }));

                const { transformRequest } = webdriverioAttachStub.lastCall.args[0];
                transformRequest(request);

                assert.equal(request.headers["X-Request-ID"], `12345${X_REQUEST_ID_DELIMITER}67890`);
            });
        });

        describe("transformResponse option", () => {
            it("should call user handler from config", async () => {
                const transformResponseStub = sinon.stub();
                const response = {};

                await initBrowser_(mkBrowser_({ transformResponse: transformResponseStub }));

                const { transformResponse } = webdriverioAttachStub.lastCall.args[0];
                transformResponse(response);

                assert.calledOnceWith(transformResponseStub, response);
            });
        });

        describe('in order to correctly work with "devtools" protocol', () => {
            it('should attach to browser with "options" property from master session', async () => {
                const sessionOpts = { foo: "bar", automationProtocol: "devtools" };

                await initBrowser_(mkBrowser_(), { sessionOpts });

                assert.calledOnceWith(webdriverioAttachStub, sinon.match.has("options", sessionOpts));
            });

            it("should attach to browser with caps merged from master session opts and caps", async () => {
                const capabilities = { browserName: "yabro" };
                const sessionCaps = { "goog:chromeOptions": { debuggerAddress: "localhost:12345" } };

                await initBrowser_(mkBrowser_(), { sessionCaps, sessionOpts: { capabilities } });

                assert.calledWithMatch(webdriverioAttachStub, {
                    capabilities: { ...capabilities, ...sessionCaps },
                });
            });
        });

        describe("in order to correctly connect to remote browser using CDP", () => {
            it('should attach to browser with "requestedCapabilities" property', async () => {
                const capabilities = { browserName: "yabro", "selenoid:options": {} };

                await initBrowser_(mkBrowser_(), { sessionOpts: { capabilities } });

                assert.calledWithMatch(webdriverioAttachStub, { requestedCapabilities: capabilities });
            });
        });

        describe("commands-history", () => {
            it("should NOT init commands-history if it is off", async () => {
                const browser = mkBrowser_({ saveHistoryMode: SAVE_HISTORY_MODE.NONE });

                await initBrowser_(browser);

                assert.notCalled(initCommandHistoryStub);
            });

            describe("should save history of executed commands", () => {
                it("if it is enabled for all tests", async () => {
                    const browser = mkBrowser_({ saveHistoryMode: SAVE_HISTORY_MODE.ALL });

                    await initBrowser_(browser);

                    assert.calledOnceWith(initCommandHistoryStub, session);
                });

                it("if it is enabled for failed tests only", async () => {
                    const browser = mkBrowser_({ saveHistoryMode: "onlyFailed" });

                    await initBrowser_(browser);

                    assert.calledOnceWith(initCommandHistoryStub, session);
                });
            });

            it("should save history of executed commands if it is enabled on fails", async () => {
                const browser = mkBrowser_({ saveHistoryMode: "onlyFailed" });

                await initBrowser_(browser);

                assert.calledOnceWith(initCommandHistoryStub, session);
            });

            it("should init commands-history before any commands have added", async () => {
                const browser = mkBrowser_({ saveHistoryMode: SAVE_HISTORY_MODE.ALL });

                await initBrowser_(browser);

                assert.callOrder(initCommandHistoryStub, session.addCommand);
            });

            it('should log "init" to history if "saveHistory" is set', async () => {
                const browser = mkBrowser_({ saveHistoryMode: SAVE_HISTORY_MODE.ALL });

                await initBrowser_(browser, {});

                assert.calledOnceWith(runGroupStub, sinon.match.any, "testplane: init browser", sinon.match.func);
            });
        });

        describe("setMeta", () => {
            it("should set value to meta-info", async () => {
                const browser = await initBrowser_();

                assert.calledWith(session.addCommand, "setMeta");
                assert.calledWith(session.addCommand, "getMeta");

                session.setMeta("foo", "bar");

                assert.equal(session.getMeta("foo"), "bar");
                assert.include(browser.meta, { foo: "bar" });
            });
        });

        describe("getMeta", () => {
            it("should get all meta if no key provided", async () => {
                await initBrowser_();

                await session.setMeta("foo", "bar");
                await session.setMeta("baz", "qux");

                const meta = await session.getMeta();
                assert.include(meta, { foo: "bar", baz: "qux" });
            });
        });

        describe("url decorator", () => {
            it("should overwrite base `url` method", async () => {
                await initBrowser_();

                assert.calledWith(session.overwriteCommand, "url", sinon.match.func);
            });

            it("should call `getUrl` command if url is not passed", async () => {
                const origUrlFn = session.url;
                await initBrowser_();

                await session.url();

                assert.calledOnceWithExactly(session.getUrl);
                assert.notCalled(origUrlFn);
            });

            it("should call original `url` method", async () => {
                const origUrlFn = session.url;
                await initBrowser_();

                await session.url("/foo/bar?baz=qux");

                assert.calledOnceWith(origUrlFn, "http://base_url/foo/bar?baz=qux");
            });

            it("should add last url to meta-info and replace path if it starts from /", async () => {
                const browser = mkBrowser_({ baseUrl: "http://some.domain.org/root" });
                await initBrowser_(browser);

                await session.url("/some/url");
                await session.url("/foo/bar?baz=qux");

                assert.equal(browser.meta.url, "http://some.domain.org/foo/bar?baz=qux");
            });

            it("should add last url to meta-info if it contains only query part", async () => {
                const browser = mkBrowser_({ baseUrl: "http://some.domain.org/root" });
                await initBrowser_(browser);

                await session.url("?baz=qux");

                assert.equal(browser.meta.url, "http://some.domain.org/root?baz=qux");
            });

            it("should concat url without slash at the beginning to the base url", async () => {
                const browser = mkBrowser_({ baseUrl: "http://some.domain.org" });
                await initBrowser_(browser);

                await session.url("some/url");

                assert.equal(browser.meta.url, "http://some.domain.org/some/url");
            });

            it("should not remove the last slash from meta url", async () => {
                const browser = mkBrowser_({ baseUrl: "http://some.domain.org" });
                await initBrowser_(browser);

                await session.url("/some/url/");

                assert.equal(browser.meta.url, "http://some.domain.org/some/url/");
            });

            it("should remove consecutive slashes in meta url", async () => {
                const browser = mkBrowser_({ baseUrl: "http://some.domain.org/" });
                await initBrowser_(browser);

                await session.url("/some/url");

                assert.equal(browser.meta.url, "http://some.domain.org/some/url");
            });

            it("should not save any url if `url` called as getter", async () => {
                const browser = await initBrowser_();

                await session.url();

                assert.notProperty(browser.meta, "url");
            });

            describe('"urlHttpTimeout" is set', () => {
                let origUrlFn;

                beforeEach(async () => {
                    origUrlFn = session.url;
                    const browser = mkBrowser_({ urlHttpTimeout: 100500, httpTimeout: 500100 });
                    await initBrowser_(browser);
                });

                it("should set http timeout for url command before calling it", async () => {
                    await session.url("/some/url");

                    assert.calledWithMatch(session.extendOptions.firstCall, { connectionRetryTimeout: 100500 });
                    assert.callOrder(session.extendOptions.withArgs({ connectionRetryTimeout: 100500 }), origUrlFn);
                });

                it("should restore http timeout after calling the url command", async () => {
                    await session.url("/some/url");

                    assert.calledWithMatch(session.extendOptions.secondCall, { connectionRetryTimeout: 500100 });
                    assert.callOrder(origUrlFn, session.extendOptions.withArgs({ connectionRetryTimeout: 500100 }));
                });
            });

            describe('"urlHttpTimeout" is not set', () => {
                it("should not set and restore http timeout for url command", async () => {
                    await initBrowser_();

                    await session.url();

                    assert.notCalled(session.extendOptions);
                });
            });
        });

        it('should add "assertView" command', async () => {
            await initBrowser_();

            assert.calledWith(session.addCommand, "assertView");
        });

        describe('"setOrientation" command', () => {
            it("should not overwrite if it does not exist", async () => {
                session.setOrientation = undefined;

                await initBrowser_();

                assert.neverCalledWith(session.overwriteCommand, "setOrientation");
            });

            it("should overwrite if it exists", async () => {
                await initBrowser_();

                assert.calledWith(session.overwriteCommand, "setOrientation");
            });
        });

        describe("perform isolation", () => {
            let cdp, incognitoBrowserCtx, incognitoPage, incognitoTarget;

            beforeEach(() => {
                incognitoTarget = mkCDPTarget_();
                incognitoPage = mkCDPPage_();
                incognitoPage.target.returns(incognitoTarget);

                incognitoBrowserCtx = mkCDPBrowserCtx_();
                incognitoBrowserCtx.newPage.resolves(incognitoPage);
                incognitoBrowserCtx.isIncognito.returns(true);

                cdp = mkCDPStub_();
                cdp.createIncognitoBrowserContext.resolves(incognitoBrowserCtx);

                session.getPuppeteer.resolves(cdp);
            });

            describe("should do nothing if", () => {
                it("'isolation' option is not specified", async () => {
                    await initBrowser_(mkBrowser_({ isolation: false }));

                    assert.notCalled(session.getPuppeteer);
                    assert.notCalled(loggerWarnStub);
                });

                it("test wasn't run in chrome", async () => {
                    const sessionCaps = { browserName: "firefox", browserVersion: "104.0" };

                    await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps });

                    assert.notCalled(session.getPuppeteer);
                });

                it(`test wasn't run in chrome@${MIN_CHROME_VERSION_SUPPORT_ISOLATION} or higher`, async () => {
                    const sessionCaps = { browserName: "chrome", browserVersion: "90.0" };

                    await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps });

                    assert.notCalled(session.getPuppeteer);
                });
            });

            describe("should warn that isolation doesn't work in", () => {
                it("chrome browser (w3c)", async () => {
                    const sessionCaps = { browserName: "chrome", browserVersion: "90.0" };

                    await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps });

                    assert.calledOnceWith(
                        loggerWarnStub,
                        `WARN: test isolation works only with chrome@${MIN_CHROME_VERSION_SUPPORT_ISOLATION} and higher, ` +
                            "but got chrome@90.0",
                    );
                });

                it("chrome browser (jsonwp)", async () => {
                    const sessionCaps = { browserName: "chrome", version: "70.0" };

                    await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps });

                    assert.calledOnceWith(
                        loggerWarnStub,
                        `WARN: test isolation works only with chrome@${MIN_CHROME_VERSION_SUPPORT_ISOLATION} and higher, ` +
                            "but got chrome@70.0",
                    );
                });
            });

            it("should create incognito browser context", async () => {
                const sessionCaps = { browserName: "chrome", browserVersion: "100.0" };

                await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps });

                assert.calledOnceWithExactly(cdp.createIncognitoBrowserContext);
            });

            it("should get current browser contexts before create incognito", async () => {
                const sessionCaps = { browserName: "chrome", browserVersion: "100.0" };

                await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps });

                assert.callOrder(cdp.browserContexts, cdp.createIncognitoBrowserContext);
            });

            it("should create new page inside incognito browser context", async () => {
                const sessionCaps = { browserName: "chrome", browserVersion: "100.0" };

                await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps });

                assert.calledOnceWithExactly(incognitoBrowserCtx.newPage);
            });

            describe(`in "${WEBDRIVER_PROTOCOL}" protocol`, () => {
                it("should switch to incognito window", async () => {
                    incognitoTarget._targetId = "456";
                    session.getWindowHandles.resolves(["window_123", "window_456", "window_789"]);

                    const sessionCaps = { browserName: "chrome", browserVersion: "100.0" };
                    const sessionOpts = { automationProtocol: WEBDRIVER_PROTOCOL };

                    await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps, sessionOpts });

                    assert.calledOnceWith(session.switchToWindow, "window_456");
                    assert.callOrder(incognitoBrowserCtx.newPage, session.getWindowHandles);
                });
            });

            describe(`in "${DEVTOOLS_PROTOCOL}" protocol`, () => {
                it("should not switch to incognito window", async () => {
                    const sessionCaps = { browserName: "chrome", browserVersion: "100.0" };
                    const sessionOpts = { automationProtocol: DEVTOOLS_PROTOCOL };

                    await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps, sessionOpts });

                    assert.notCalled(session.getWindowHandles);
                    assert.notCalled(session.switchToWindow);
                });
            });

            it("should close pages in default browser context", async () => {
                const defaultBrowserCtx = mkCDPBrowserCtx_();
                const page1 = mkCDPPage_();
                const page2 = mkCDPPage_();
                defaultBrowserCtx.pages.resolves([page1, page2]);

                cdp.browserContexts.returns([defaultBrowserCtx, incognitoBrowserCtx]);

                const sessionCaps = { browserName: "chrome", browserVersion: "100.0" };

                await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps });

                assert.calledOnceWithExactly(page1.close);
                assert.calledOnceWithExactly(page2.close);
                assert.notCalled(incognitoPage.close);
            });

            it("should close incognito browser context", async () => {
                const defaultBrowserCtx = mkCDPBrowserCtx_();
                cdp.browserContexts.returns([defaultBrowserCtx, incognitoBrowserCtx]);

                const sessionCaps = { browserName: "chrome", browserVersion: "100.0" };

                await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps });

                assert.calledOnceWithExactly(incognitoBrowserCtx.close);
                assert.notCalled(defaultBrowserCtx.close);
            });

            it("should not close pages in BiDi protocol", async () => {
                webdriverioAttachStub.resolves({ ...mkSessionStub_(), isBidi: true });

                const defaultBrowserCtx = mkCDPBrowserCtx_();
                const page1 = mkCDPPage_();
                const page2 = mkCDPPage_();
                defaultBrowserCtx.pages.resolves([page1, page2]);
                cdp.browserContexts.returns([defaultBrowserCtx, incognitoBrowserCtx]);

                const sessionCaps = { browserName: "chrome", browserVersion: "100.0", webSocketUrl: true };

                await initBrowser_(mkBrowser_({ isolation: true }), { sessionCaps });

                assert.notCalled(page1.close);
                assert.notCalled(page2.close);
                assert.notCalled(incognitoPage.close);
            });
        });

        it("should call prepareBrowser on new browser", async () => {
            const prepareBrowser = sandbox.stub();
            const browser = mkBrowser_({ prepareBrowser });

            await initBrowser_(browser);

            assert.calledOnceWith(prepareBrowser, session);
        });

        it("should not fail on error in prepareBrowser", async () => {
            const prepareBrowser = sandbox.stub().throws();
            const browser = mkBrowser_({ prepareBrowser });

            await initBrowser_(browser);

            assert.calledOnce(loggerWarnStub);
        });

        describe("set browser orientation", () => {
            it("should not set orientation if it is not specified in a config", async () => {
                await initBrowser_();

                assert.notCalled(session.setOrientation);
            });

            it("should set orientation which is specified in a config", async () => {
                const browser = mkBrowser_({ orientation: "portrait" });

                await initBrowser_(browser);

                assert.calledOnceWith(session.setOrientation, "portrait");
            });
        });

        describe("set winidow size", () => {
            it("should not set window size if it is not specified in a config", async () => {
                await initBrowser_();

                assert.notCalled(session.setWindowSize);
            });

            it("should set window size from config", async () => {
                const browser = mkBrowser_({ windowSize: { width: 100500, height: 500100 } });

                await initBrowser_(browser);

                assert.calledOnceWith(session.setWindowSize, 100500, 500100);
            });
        });

        describe("camera calibration", () => {
            let calibrator;

            beforeEach(() => {
                calibrator = sinon.createStubInstance(Calibrator);

                calibrator.calibrate.resolves();

                sandbox.stub(Camera.prototype, "calibrate");
            });

            it("should perform calibration if `calibrate` is turn on", async () => {
                calibrator.calibrate.withArgs(sinon.match.instanceOf(ExistingBrowser)).resolves({ foo: "bar" });
                const browser = mkBrowser_({ calibrate: true });

                await initBrowser_(browser, {}, calibrator);

                assert.calledOnceWith(Camera.prototype.calibrate, { foo: "bar" });
            });

            it("should not perform calibration if `calibrate` is turn off", async () => {
                const browser = mkBrowser_({ calibrate: false });

                await initBrowser_(browser, {}, calibrator);

                assert.notCalled(Camera.prototype.calibrate);
            });

            it("should perform calibration after attaching of a session", async () => {
                const browser = mkBrowser_({ calibrate: true });

                await initBrowser_(browser, {}, calibrator);

                const calibratorArg = calibrator.calibrate.lastCall.args[0];
                assert.equal(calibratorArg, browser);
            });
        });

        it("should build client scripts", async () => {
            const calibrator = sinon.createStubInstance(Calibrator);
            calibrator.calibrate.resolves({ foo: "bar" });
            const browser = mkBrowser_({ calibrate: true });

            await initBrowser_(browser, {}, calibrator);

            assert.calledOnceWith(clientBridgeBuildStub, browser, { calibration: { foo: "bar" } });
        });
    });

    describe("prepareScreenshot", () => {
        it("should prepare screenshot", async () => {
            const clientBridge = stubClientBridge_();
            clientBridge.call.withArgs("prepareScreenshot").resolves({ foo: "bar" });

            const browser = await initBrowser_();

            await assert.becomes(browser.prepareScreenshot(), { foo: "bar" });
        });

        it("should prepare screenshot for passed selectors", async () => {
            const clientBridge = stubClientBridge_();
            const browser = await initBrowser_();

            await browser.prepareScreenshot([".foo", ".bar"]);
            const selectors = clientBridge.call.lastCall.args[1][0];

            assert.deepEqual(selectors, [".foo", ".bar"]);
        });

        it("should prepare screenshot using passed options", async () => {
            const clientBridge = stubClientBridge_();
            const browser = await initBrowser_();

            await browser.prepareScreenshot([], { foo: "bar" });
            const opts = clientBridge.call.lastCall.args[1][1];

            assert.propertyVal(opts, "foo", "bar");
        });

        it("should extend options by calibration results", async () => {
            const clientBridge = stubClientBridge_();
            const calibrator = sinon.createStubInstance(Calibrator);
            calibrator.calibrate.resolves({ usePixelRatio: false });

            const browser = mkBrowser_({ calibrate: true });
            await initBrowser_(browser, {}, calibrator);

            await browser.prepareScreenshot();

            const opts = clientBridge.call.lastCall.args[1][1];
            assert.propertyVal(opts, "usePixelRatio", false);
        });

        it("should use pixel ratio by default if calibration was not met", async () => {
            const clientBridge = stubClientBridge_();
            const browser = mkBrowser_({ calibrate: false });
            await initBrowser_(browser);

            await browser.prepareScreenshot();
            const opts = clientBridge.call.lastCall.args[1][1];

            assert.propertyVal(opts, "usePixelRatio", true);
        });

        it("should throw error from browser", async () => {
            const clientBridge = stubClientBridge_();
            clientBridge.call.withArgs("prepareScreenshot").resolves({ error: "JS", message: "stub error" });

            const browser = await initBrowser_();

            await assert.isRejected(
                browser.prepareScreenshot(),
                "Prepare screenshot failed with error type 'JS' and error message: stub error",
            );
        });

        describe("'disableAnimation: true' and 'automationProtocol: webdriver'", () => {
            it("should disable animations", async () => {
                const clientBridge = stubClientBridge_();
                const browser = await initBrowser_(mkBrowser_({ automationProtocol: "webdriver" }));
                const iframeElement1 = { "element-12345": "67890_element_1" };
                const iframeElement2 = { "element-54321": "09876_element_2" };
                browser.publicAPI.findElements
                    .withArgs("css selector", "iframe")
                    .resolves([iframeElement1, iframeElement2]);

                await browser.prepareScreenshot(".selector", { disableAnimation: true });

                assert.callOrder(
                    clientBridge.call.withArgs("prepareScreenshot", [
                        ".selector",
                        sinon.match({ disableAnimation: true }),
                    ]),

                    browser.publicAPI.switchToFrame.withArgs(iframeElement1),
                    clientBridge.call.withArgs("disableFrameAnimations"),
                    browser.publicAPI.switchToFrame.withArgs(null),

                    browser.publicAPI.switchToFrame.withArgs(iframeElement2),
                    clientBridge.call.withArgs("disableFrameAnimations"),
                    browser.publicAPI.switchToFrame.withArgs(null),
                );
            });
        });

        it("should not disable iframe animations if 'disableAnimation: true' and 'automationProtocol: devtools'", async () => {
            const clientBridge = stubClientBridge_();
            const browser = await initBrowser_(mkBrowser_({ automationProtocol: "devtools" }));

            await browser.prepareScreenshot(".selector", { disableAnimation: true });

            assert.calledWith(clientBridge.call, "prepareScreenshot", [
                ".selector",
                sinon.match({ disableAnimation: true }),
            ]);
            assert.notCalled(browser.publicAPI.switchToFrame);
            assert.neverCalledWith(clientBridge.call, "disableFrameAnimations");
        });

        it("should not disable animations if 'disableAnimation: false'", async () => {
            const clientBridge = stubClientBridge_();
            const browser = await initBrowser_(mkBrowser_({ automationProtocol: "webdriver" }));
            const iframeElement = { "element-12345": "67890_element_1" };
            browser.publicAPI.findElements.withArgs("css selector", "iframe").resolves([iframeElement]);

            await browser.prepareScreenshot(".selector", { disableAnimation: false });

            assert.neverCalledWith(clientBridge.call, "prepareScreenshot", [
                ".selector",
                sinon.match({ disableAnimation: true }),
            ]);
            assert.neverCalledWith(browser.publicAPI.switchToFrame, iframeElement);
            assert.neverCalledWith(clientBridge.call, "disableFrameAnimations");
        });
    });

    describe("cleanupScreenshot", () => {
        it("should cleanup parent frame if 'disableAnimation: true'", async () => {
            const clientBridge = stubClientBridge_();
            const browser = await initBrowser_(mkBrowser_({ automationProtocol: "webdriver" }));

            await browser.cleanupScreenshot({ disableAnimation: true });

            assert.calledWith(clientBridge.call, "cleanupFrameAnimations");
        });

        it("should not cleanup frames if 'disableAnimation: false'", async () => {
            const clientBridge = stubClientBridge_();
            const browser = await initBrowser_(mkBrowser_({ automationProtocol: "webdriver" }));

            await browser.cleanupScreenshot({ disableAnimation: false });

            assert.neverCalledWith(clientBridge.call, "cleanupFrameAnimations");
        });

        it("should not cleanup animations in iframe if 'automationProtocol: devtools'", async () => {
            stubClientBridge_();
            const browser = await initBrowser_(mkBrowser_({ automationProtocol: "devtools" }));

            await browser.cleanupScreenshot({ disableAnimation: true });

            assert.notCalled(browser.publicAPI.switchToFrame);
        });

        describe("'automationProtocol: webdriver'", () => {
            it("should cleanup animations in iframe", async () => {
                const clientBridge = stubClientBridge_();
                const browser = await initBrowser_(mkBrowser_({ automationProtocol: "webdriver" }));
                const iframeElement = { "element-12345": "67890_element_1" };
                browser.publicAPI.findElements.withArgs("css selector", "iframe").resolves([iframeElement]);

                await browser.cleanupScreenshot({ disableAnimation: true });

                assert.calledWith(browser.publicAPI.switchToFrame, iframeElement);
                assert.calledWith(clientBridge.call, "cleanupFrameAnimations");
                assert.callOrder(browser.publicAPI.switchToFrame, clientBridge.call);
            });

            it("should switch to parent frame after clean animations in iframe", async () => {
                stubClientBridge_();
                const browser = await initBrowser_(mkBrowser_({ automationProtocol: "webdriver" }));
                const iframeElement = { "element-12345": "67890_element_1" };
                browser.publicAPI.findElements.withArgs("css selector", "iframe").resolves([iframeElement]);

                await browser.cleanupScreenshot({ disableAnimation: true });

                assert.callOrder(
                    browser.publicAPI.switchToFrame.withArgs(iframeElement),
                    browser.publicAPI.switchToFrame.withArgs(null),
                );
            });

            it("should not switch to any frame if there are no iframes on the page ", async () => {
                stubClientBridge_();
                const browser = await initBrowser_(mkBrowser_({ automationProtocol: "webdriver" }));
                browser.publicAPI.findElements.withArgs("css selector", "iframe").resolves([]);

                await browser.cleanupScreenshot({ disableAnimation: true });

                assert.notCalled(browser.publicAPI.switchToFrame);
            });
        });
    });

    describe("open", () => {
        it("should open URL", async () => {
            const browser = await initBrowser_();

            await browser.open("some-url");

            assert.calledOnceWith(session.url, "some-url");
        });
    });

    describe("evalScript", () => {
        it("should execute script with added `return` operator", async () => {
            const browser = await initBrowser_();

            await browser.evalScript("some-script");

            assert.calledOnceWith(session.execute, "return some-script");
        });

        it("should return the value of the executed script", async () => {
            session.execute.resolves({ foo: "bar" });
            const browser = await initBrowser_();

            const result = await browser.evalScript("some-script");

            assert.deepEqual(result, { foo: "bar" });
        });
    });

    describe("captureViewportImage", () => {
        beforeEach(() => {
            sandbox.stub(Camera.prototype, "captureViewportImage");
            sandbox.stub(global, "setTimeout").callsFake(fn => fn());
        });

        it("should delay capturing on the passed time", () => {
            Camera.prototype.captureViewportImage.withArgs({ foo: "bar" }).resolves({ some: "image" });

            return mkBrowser_({ screenshotDelay: 100500 })
                .captureViewportImage({ foo: "bar" }, 2000)
                .then(() => {
                    assert.calledOnceWith(global.setTimeout, sinon.match.any, 2000);
                    assert.callOrder(global.setTimeout, Camera.prototype.captureViewportImage);
                });
        });

        it("should delegate actual capturing to camera object", () => {
            Camera.prototype.captureViewportImage.withArgs({ foo: "bar" }).resolves({ some: "image" });

            return mkBrowser_()
                .captureViewportImage({ foo: "bar" })
                .then(image => assert.deepEqual(image, { some: "image" }));
        });
    });

    describe("scrollBy", () => {
        let cleanupJsdom;

        beforeEach(() => {
            cleanupJsdom = jsdom();
            global.window.scrollTo = sinon.stub();
            global.document.querySelector = sinon.stub();
        });

        afterEach(() => {
            cleanupJsdom();
        });

        it("should throw error if passed selector is not found", async () => {
            const args = { x: 10, y: 20, selector: ".non-existent" };
            global.document.querySelector.withArgs(".non-existent").returns(null);
            const browser = await initBrowser_();

            browser.scrollBy(args);

            try {
                session.execute.lastCall.args[0](args);
            } catch (e) {
                assert.match(e.message, /Scroll screenshot failed with:.*\.non-existent/);
            }
        });

        describe("should scroll page relative to", () => {
            it('passed selector with calculated "x" and "y" coords', async () => {
                const domElem = {
                    scrollLeft: 10,
                    scrollTop: 20,
                    scrollTo: sinon.stub(),
                };
                const args = { x: 10, y: 20, selector: ".some-selector" };
                global.document.querySelector.withArgs(".some-selector").returns(domElem);
                const browser = await initBrowser_();

                browser.scrollBy(args);
                session.execute.lastCall.args[0](args);

                assert.calledOnceWith(domElem.scrollTo, 20, 40);
            });

            it('window with calculated "x" and "y" coords', async () => {
                global.window.pageXOffset = 10;
                global.window.pageYOffset = 20;
                const args = { x: 10, y: 20 };
                const browser = await initBrowser_();

                browser.scrollBy(args);
                session.execute.lastCall.args[0](args);

                assert.calledOnceWith(global.window.scrollTo, 20, 40);
            });
        });
    });

    describe("markAsBroken", () => {
        it("should not be marked as broken by default", () => {
            const browser = mkBrowser_();

            assert.equal(browser.state.isBroken, false);
        });

        it("should mark browser as broken", async () => {
            const browser = await initBrowser_();

            browser.markAsBroken();

            assert.equal(browser.state.isBroken, true);
        });

        it('should not stub "deleteSession" command', async () => {
            session.commandList = ["deleteSession"];
            session.deleteSession = () => "deleted";
            const browser = await initBrowser_();

            browser.markAsBroken();

            assert.equal(session.deleteSession(), "deleted");
        });

        it("should not stub session properties", async () => {
            session.commandList = ["isProp"];
            session.isProp = true;
            const browser = await initBrowser_();

            browser.markAsBroken();

            assert.isTrue(session.isProp);
        });

        it("should stub session commands", async () => {
            session.commandList = ["foo"];
            session.foo = () => "foo";
            const browser = await initBrowser_();

            browser.markAsBroken();

            const result = await session.foo();
            assert.isUndefined(result);
        });

        it("should not mark session as broken twice", async () => {
            session.commandList = ["foo"];
            session.foo = () => "foo";
            const browser = await initBrowser_();

            browser.markAsBroken();
            session.overwriteCommand.resetHistory();
            browser.markAsBroken();

            assert.notCalled(session.overwriteCommand);
        });
    });

    describe("quit", () => {
        it("should keep process id in meta", async () => {
            const browser = await initBrowser_();
            const pid = browser.meta.pid;

            browser.quit();

            assert.equal(browser.meta.pid, pid);
        });
    });
});
