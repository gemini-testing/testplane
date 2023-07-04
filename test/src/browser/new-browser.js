"use strict";

const webdriverio = require("webdriverio");
const logger = require("src/utils/logger");
const signalHandler = require("src/signal-handler");
const history = require("src/browser/history");
const { WEBDRIVER_PROTOCOL, SAVE_HISTORY_MODE } = require("src/constants/config");
const { mkNewBrowser_: mkBrowser_, mkSessionStub_ } = require("./utils");

describe("NewBrowser", () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_();
        sandbox.stub(logger);
        sandbox.stub(webdriverio, "remote").resolves(session);
    });

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        it("should create session with properties from browser config", async () => {
            await mkBrowser_().init();

            assert.calledOnceWith(webdriverio.remote, {
                protocol: "http",
                hostname: "test_host",
                port: 4444,
                path: "/wd/hub",
                queryParams: { query: "value" },
                capabilities: { browserName: "browser", version: "1.0" },
                automationProtocol: WEBDRIVER_PROTOCOL,
                waitforTimeout: 100,
                waitforInterval: 50,
                logLevel: "trace",
                connectionRetryTimeout: 3000,
                connectionRetryCount: 0,
                baseUrl: "http://base_url",
            });
        });

        it("should pass default port if it is not specified in grid url", async () => {
            await mkBrowser_({ gridUrl: "http://some-host/some-path" }).init();

            assert.calledWithMatch(webdriverio.remote, { port: 4444 });
        });

        describe("headless setting", () => {
            it("should generate browser specific settings - chrome", async () => {
                await mkBrowser_({
                    headless: true,
                    desiredCapabilities: { browserName: "chrome" },
                }).init();

                assert.calledWithMatch(webdriverio.remote, {
                    capabilities: {
                        browserName: "chrome",
                        "goog:chromeOptions": { args: ["headless", "disable-gpu"] },
                    },
                });
            });

            it("should generate browser specific settings - firefox", async () => {
                await mkBrowser_({
                    headless: true,
                    desiredCapabilities: { browserName: "firefox" },
                }).init();

                assert.calledWithMatch(webdriverio.remote, {
                    capabilities: {
                        browserName: "firefox",
                        "moz:firefoxOptions": { args: ["-headless"] },
                    },
                });
            });

            it("should generate browser specific settings - edge", async () => {
                await mkBrowser_({
                    headless: true,
                    desiredCapabilities: { browserName: "msedge" },
                }).init();

                assert.calledWithMatch(webdriverio.remote, {
                    capabilities: { browserName: "msedge", "ms:edgeOptions": { args: ["--headless"] } },
                });
            });

            it("not override existing settings", async () => {
                await mkBrowser_({
                    headless: true,
                    desiredCapabilities: {
                        browserName: "chrome",
                        "goog:chromeOptions": { args: ["my", "custom", "flags"] },
                    },
                }).init();

                assert.calledWithMatch(webdriverio.remote, {
                    capabilities: {
                        browserName: "chrome",
                        "goog:chromeOptions": { args: ["my", "custom", "flags", "headless", "disable-gpu"] },
                    },
                });
            });

            it("should issue a warning for an unsupported browser", async () => {
                await mkBrowser_({
                    headless: true,
                    desiredCapabilities: { browserName: "safari" },
                }).init();

                assert.calledOnceWith(logger.warn, "WARNING: Headless setting is not supported for safari browserName");
            });
        });

        describe('should create session with extended "browserVersion" in desiredCapabilities if', () => {
            it("it is already exists in capabilities", async () => {
                await mkBrowser_(
                    { desiredCapabilities: { browserName: "browser", browserVersion: "1.0" } },
                    "browser",
                    "2.0",
                ).init();

                assert.calledWithMatch(webdriverio.remote, {
                    capabilities: { browserName: "browser", browserVersion: "2.0" },
                });
            });

            it("w3c protocol is used", async () => {
                await mkBrowser_({ sessionEnvFlags: { isW3C: true } }, "browser", "2.0").init();

                assert.calledWithMatch(webdriverio.remote, {
                    capabilities: { browserName: "browser", browserVersion: "2.0" },
                });
            });
        });

        describe("extendOptions command", () => {
            it("should add command", async () => {
                await mkBrowser_().init();

                assert.calledWith(session.addCommand, "extendOptions");
            });

            it("should add new option to wdio options", async () => {
                await mkBrowser_().init();

                session.extendOptions({ newOption: "foo" });
                assert.propertyVal(session.options, "newOption", "foo");
            });
        });
    });

    describe("init", () => {
        it("should resolve promise with browser", async () => {
            const browser = mkBrowser_();

            await assert.eventually.equal(browser.init(), browser);
        });

        it("should use session request timeout for create a session", async () => {
            await mkBrowser_({ sessionRequestTimeout: 100500, httpTimeout: 500100 }).init();

            assert.calledWithMatch(webdriverio.remote, { connectionRetryTimeout: 100500 });
        });

        it("should use http timeout for create a session if session request timeout not set", async () => {
            await mkBrowser_({ sessionRequestTimeout: null, httpTimeout: 500100 }).init();

            assert.calledWithMatch(webdriverio.remote, { connectionRetryTimeout: 500100 });
        });

        it("should reset options to default after create a session", async () => {
            await mkBrowser_().init();

            assert.callOrder(webdriverio.remote, session.extendOptions);
        });

        it("should reset http timeout to default after create a session", async () => {
            await mkBrowser_({ sessionRequestTimeout: 100500, httpTimeout: 500100 }).init();

            assert.propertyVal(session.options, "connectionRetryTimeout", 500100);
        });

        it("should not set page load timeout if it is not specified in a config", async () => {
            await mkBrowser_({ pageLoadTimeout: null }).init();

            assert.notCalled(session.setTimeout);
            assert.notCalled(session.setTimeouts);
        });

        describe("commands-history", () => {
            beforeEach(() => {
                sandbox.spy(history, "initCommandHistory");
            });

            it("should NOT init commands-history if it is off", async () => {
                await mkBrowser_({ saveHistoryMode: SAVE_HISTORY_MODE.NONE }).init();

                assert.notCalled(history.initCommandHistory);
            });

            it("should save history of executed commands if it is enabled", async () => {
                await mkBrowser_({ saveHistoryMode: SAVE_HISTORY_MODE.ALL }).init();

                assert.calledOnceWith(history.initCommandHistory, session);
            });

            it("should save history of executed commands if it is enabled on fails", async () => {
                await mkBrowser_({ saveHistoryMode: "onlyFailed" }).init();

                assert.calledOnceWith(history.initCommandHistory, session);
            });

            it("should init commands-history before any commands have added", async () => {
                await mkBrowser_({ saveHistoryMode: SAVE_HISTORY_MODE.ALL }).init();

                assert.callOrder(history.initCommandHistory, session.addCommand);
            });

            it('should log "init" to history if "saveHistoryMode" and "pageLoadTimeout" are set', async () => {
                const browser = mkBrowser_({ saveHistoryMode: SAVE_HISTORY_MODE.ALL, pageLoadTimeout: 500100 });
                sandbox.stub(history, "runGroup");
                await browser.init();

                assert.calledOnceWith(history.runGroup, sinon.match.any, "hermione: init browser", sinon.match.func);
            });
        });

        describe("set page load timeout if it is specified in a config", () => {
            let browser;

            beforeEach(() => {
                browser = mkBrowser_({ pageLoadTimeout: 100500 });
            });

            it("should set timeout", async () => {
                await browser.init();

                assert.calledOnceWith(session.setTimeout, { pageLoad: 100500 });
            });

            [
                { name: "not in edge browser without w3c support", browserName: "yabro", isW3C: false },
                { name: "not in edge browser with w3c support", browserName: "yabro", isW3C: true },
                { name: "in edge browser without w3c support", browserName: "MicrosoftEdge", isW3C: false },
            ].forEach(({ name, browserName, isW3C }) => {
                it(`should throw if set timeout failed ${name}`, async () => {
                    session.capabilities = { browserName };
                    session.isW3C = isW3C;
                    session.setTimeout.withArgs({ pageLoad: 100500 }).throws(new Error("o.O"));

                    await assert.isRejected(browser.init(), "o.O");
                    assert.notCalled(logger.warn);
                });
            });

            it("should not throw if set timeout failed in edge browser with w3c support", async () => {
                session.capabilities = { browserName: "MicrosoftEdge" };
                session.isW3C = true;
                session.setTimeout.withArgs({ pageLoad: 100500 }).throws(new Error("o.O"));

                await assert.isFulfilled(browser.init());
                assert.calledOnceWith(logger.warn, "WARNING: Can not set page load timeout: o.O");
            });
        });
    });

    describe("reset", () => {
        it("should be fulfilled", () => assert.isFulfilled(mkBrowser_().reset()));
    });

    describe("quit", () => {
        it("should finalize webdriver.io session", async () => {
            const browser = await mkBrowser_().init();

            await browser.quit();

            assert.called(session.deleteSession);
        });

        it("should finalize session on global exit event", async () => {
            await mkBrowser_().init();

            signalHandler.emitAndWait("exit");

            assert.called(session.deleteSession);
        });

        it("should set custom options before finalizing of a session", async () => {
            const browser = await mkBrowser_().init();

            await browser.quit();

            assert.callOrder(session.extendOptions, session.deleteSession);
        });

        it("should use session quit timeout for finalizing of a session", async () => {
            const browser = await mkBrowser_({ sessionQuitTimeout: 100500, httpTimeout: 500100 }).init();

            await browser.quit();

            assert.propertyVal(session.options, "connectionRetryTimeout", 100500);
        });
    });

    describe("sessionId", () => {
        it("should return session id of initialized webdriver session", async () => {
            session.sessionId = "foo";

            const browser = await mkBrowser_().init();

            assert.equal(browser.sessionId, "foo");
        });
    });

    describe("error handling", () => {
        it("should warn in case of failed end", async () => {
            session.deleteSession.rejects(new Error("failed end"));
            const browser = await mkBrowser_().init();

            await browser.quit();

            assert.called(logger.warn);
        });
    });
});
