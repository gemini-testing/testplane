import sinon, { SinonStub } from "sinon";
import crypto from "crypto";
import proxyquire from "proxyquire";
import signalHandler from "src/signal-handler";
import { runGroup } from "src/browser/history";
import { WEBDRIVER_PROTOCOL } from "src/constants/config";
import { X_REQUEST_ID_DELIMITER } from "src/constants/browser";
import RuntimeConfig from "src/config/runtime-config";
import { createBrowserConfig_, mkNewBrowser_, mkSessionStub_, mkWdPool_ } from "./utils";
import { Config } from "src/config";
import { RequestOptions } from "node:https";
import { DesiredCapabilities, SelenoidOptions } from "@testplane/wdio-types/build/Capabilities";

describe("NewBrowser", () => {
    const sandbox = sinon.createSandbox();
    let session: any;
    let NewBrowser: any;
    let webdriverioRemoteStub: SinonStub;
    let runGroupStub: SinonStub;
    let initCommandHistoryStub: SinonStub;
    let installBrowserStub: SinonStub;
    let runDockerBrowserStub: SinonStub;
    let warnStub: SinonStub;
    let logStub: SinonStub;

    const mkBrowser_ = (configOpts?: Partial<Config>, opts?: any): any => {
        return mkNewBrowser_(configOpts, opts, NewBrowser);
    };

    beforeEach(() => {
        session = mkSessionStub_();
        installBrowserStub = sandbox.stub().resolves("/browser/path");
        runDockerBrowserStub = sandbox.stub().resolves({
            gridUrl: "http://127.0.0.1:23456/wd/hub",
            free: sandbox.stub().resolves(),
            kill: sandbox.stub().resolves(),
            getPid: () => undefined,
            getLogs: sandbox.stub().resolves(""),
            saveLogs: sandbox.stub().resolves("/tmp/testplane-logs/1234567890.log"),
            startCdpProxy: sandbox.stub().resolves(),
        });
        warnStub = sandbox.stub();
        logStub = sandbox.stub();
        webdriverioRemoteStub = sandbox.stub().resolves(session);
        runGroupStub = sandbox.stub().callsFake(runGroup);
        initCommandHistoryStub = sandbox.stub();

        NewBrowser = proxyquire("src/browser/new-browser", {
            "@testplane/webdriverio": {
                remote: webdriverioRemoteStub,
            },
            "../browser-installer": { installBrowser: installBrowserStub },
            "./docker": { runDockerBrowser: runDockerBrowserStub },
            "../utils/logger": { warn: warnStub, log: logStub },
            "./history": {
                runGroup: runGroupStub,
            },
            "./browser": proxyquire("src/browser/browser", {
                "./history": {
                    runGroup: runGroupStub,
                    initCommandHistory: initCommandHistoryStub,
                },
            }),
        }).NewBrowser;

        sandbox.stub(RuntimeConfig, "getInstance").returns({ local: undefined });
    });

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        it("should create session with properties from browser config", async () => {
            await mkBrowser_().init();

            assert.calledOnceWith(webdriverioRemoteStub, {
                protocol: "http",
                hostname: "test_host",
                port: 4444,
                path: "/wd/hub",
                queryParams: { query: "value" },
                capabilities: {
                    browserName: "browser",
                    version: "1.0",
                    "wdio:enforceWebDriverClassic": true,
                },
                automationProtocol: WEBDRIVER_PROTOCOL,
                waitforTimeout: 100,
                waitforInterval: 50,
                connectionRetryTimeout: 3000,
                connectionRetryCount: 3,
                baseUrl: "http://base_url",
                transformRequest: sinon.match.func,
            });
        });

        it("should pass default port if it is not specified in grid url", async () => {
            await mkBrowser_({ gridUrl: "http://some-host/some-path" }).init();

            assert.calledWithMatch(webdriverioRemoteStub, { port: 4444 });
        });

        describe("headless setting", () => {
            describe("chrome", () => {
                it("should generate browser specific settings", async () => {
                    await mkBrowser_({
                        headless: true,
                        desiredCapabilities: { browserName: "chrome" },
                    }).init();

                    assert.calledWithMatch(webdriverioRemoteStub, {
                        capabilities: {
                            browserName: "chrome",
                            "goog:chromeOptions": { args: ["headless", "disable-gpu"] },
                        },
                    });
                });

                it("should add passed value to args if string was passed", async () => {
                    await mkBrowser_({
                        headless: "new",
                        desiredCapabilities: { browserName: "chrome" },
                    }).init();

                    assert.calledWithMatch(webdriverioRemoteStub, {
                        capabilities: {
                            browserName: "chrome",
                            "goog:chromeOptions": { args: ["headless=new", "disable-gpu"] },
                        },
                    });
                });
            });

            it("should generate browser specific settings - firefox", async () => {
                await mkBrowser_({
                    headless: true,
                    desiredCapabilities: { browserName: "firefox" },
                }).init();

                assert.calledWithMatch(webdriverioRemoteStub, {
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

                assert.calledWithMatch(webdriverioRemoteStub, {
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

                assert.calledWithMatch(webdriverioRemoteStub, {
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

                assert.calledOnceWith(warnStub, "WARNING: Headless setting is not supported for safari browserName");
            });
        });

        describe('should create session with extended "browserVersion" in desiredCapabilities if', () => {
            it("it is already exists in capabilities", async () => {
                await mkBrowser_(
                    { desiredCapabilities: { browserName: "browser", browserVersion: "1.0" } },
                    { id: "browser", version: "2.0" },
                ).init();

                assert.calledWithMatch(webdriverioRemoteStub, {
                    capabilities: { browserName: "browser", browserVersion: "2.0" },
                });
            });

            it("w3c protocol is used", async () => {
                await mkBrowser_({ sessionEnvFlags: { isW3C: true } }, { id: "browser", version: "2.0" }).init();

                assert.calledWithMatch(webdriverioRemoteStub, {
                    capabilities: { browserName: "browser", browserVersion: "2.0" },
                });
            });
        });

        describe('should create session with extended "wdio:enforceWebDriverClassic"', () => {
            it('should set capability if "webSocketUrl" is not set by user', async () => {
                const desiredCapabilities = { browserName: "chrome" };

                await mkBrowser_({ desiredCapabilities }).init();

                assert.calledWithMatch(webdriverioRemoteStub, {
                    capabilities: { ...desiredCapabilities, "wdio:enforceWebDriverClassic": true },
                });
            });

            describe("should not set capability if", () => {
                it('"webSocketUrl" set by user', async () => {
                    const desiredCapabilities = { browserName: "chrome", webSocketUrl: true };

                    await mkBrowser_({ desiredCapabilities }).init();

                    assert.calledWithMatch(webdriverioRemoteStub, {
                        capabilities: desiredCapabilities,
                    });
                });

                it('"wdio:enforceWebDriverClassic" set by user', async () => {
                    const desiredCapabilities = { browserName: "chrome", "wdio:enforceWebDriverClassic": false };

                    await mkBrowser_({ desiredCapabilities }).init();

                    assert.calledWithMatch(webdriverioRemoteStub, {
                        capabilities: desiredCapabilities,
                    });
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

            assert.calledWithMatch(webdriverioRemoteStub, { connectionRetryTimeout: 100500 });
        });

        it("should use http timeout for create a session if session request timeout not set", async () => {
            await mkBrowser_({ sessionRequestTimeout: null, httpTimeout: 500100 }).init();

            assert.calledWithMatch(webdriverioRemoteStub, { connectionRetryTimeout: 500100 });
        });

        it("should reset options to default after create a session", async () => {
            await mkBrowser_().init();

            assert.callOrder(webdriverioRemoteStub, session.extendOptions);
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

        describe("transformRequest option", () => {
            beforeEach(() => {
                sandbox.stub(crypto, "randomUUID").returns("0-0-0-0-0");
            });

            it("should call user handler from config", async () => {
                const request = { headers: {} };
                const transformRequestStub = sandbox.stub().returns(request);

                await mkBrowser_({ transformRequest: transformRequestStub }).init();

                const { transformRequest } = webdriverioRemoteStub.lastCall.args[0];
                transformRequest(request);

                assert.calledOnceWith(transformRequestStub, request);
            });

            it('should not add "X-Request-ID" header if it is already add by user', async () => {
                const request: RequestOptions = { headers: {} };
                const transformRequestStub = (req: RequestOptions): RequestOptions => {
                    (req.headers as Record<string, string>)["X-Request-ID"] = "100500";
                    return req;
                };

                await mkBrowser_({ transformRequest: transformRequestStub }).init();

                const { transformRequest } = webdriverioRemoteStub.lastCall.args[0];
                transformRequest(request);

                assert.equal((request.headers as Record<string, string>)["X-Request-ID"], "100500");
            });

            it('should add "X-Request-ID" header', async () => {
                (crypto.randomUUID as SinonStub).returns("67890");
                const state = { testXReqId: "12345" };
                const request: RequestOptions = { headers: {} };

                await mkBrowser_({}, { state }).init();

                const { transformRequest } = webdriverioRemoteStub.lastCall.args[0];
                transformRequest(request);

                assert.equal(
                    (request.headers as Record<string, string>)["X-Request-ID"],
                    `12345${X_REQUEST_ID_DELIMITER}67890`,
                );
            });
        });

        describe("transformResponse option", () => {
            it("should call user handler from config", async () => {
                const transformResponseStub = sandbox.stub();
                const response = {};

                await mkBrowser_({ transformResponse: transformResponseStub }).init();

                const { transformResponse } = webdriverioRemoteStub.lastCall.args[0];
                transformResponse(response);

                assert.calledOnceWith(transformResponseStub, response);
            });
        });

        describe("set page load timeout if it is specified in a config", () => {
            let browser: any;

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
                    assert.notCalled(warnStub);
                });
            });

            it("should not throw if set timeout failed in edge browser with w3c support", async () => {
                session.capabilities = { browserName: "MicrosoftEdge" };
                session.isW3C = true;
                session.setTimeout.withArgs({ pageLoad: 100500 }).throws(new Error("o.O"));

                await assert.isFulfilled(browser.init());
                assert.calledOnceWith(warnStub, "WARNING: Can not set page load timeout: o.O");
            });

            it("should preserve init error and clean up if session deletion fails", async () => {
                const initError = new Error("failed to set page load timeout");
                const deleteError = new Error("failed to delete partial session");
                const wdProcess = {
                    gridUrl: "http://localhost:12345/",
                    free: sandbox.stub(),
                    kill: sandbox.stub(),
                    getPid: sandbox.stub().returns(12345),
                };
                const wdPool = { getWebdriver: sandbox.stub().resolves(wdProcess) };
                session.setTimeout.rejects(initError);
                session.deleteSession.rejects(deleteError);
                const exitListenerCount = signalHandler.listenerCount("exit");
                const browser = mkBrowser_(
                    {
                        gridUrl: "local",
                        pageLoadTimeout: 100500,
                        desiredCapabilities: {
                            browserName: "chrome",
                            browserVersion: "115.0",
                        },
                    },
                    { wdPool },
                );

                const error = await browser.init().catch((error: Error) => error);

                await Promise.all([browser.quit(), browser.kill()]);

                assert.strictEqual(error, initError);
                assert.calledOnce(session.deleteSession);
                assert.notCalled(wdProcess.free);
                assert.calledOnce(wdProcess.kill);
                assert.isUndefined(browser.getDriverPid());
                assert.calledOnceWith(
                    warnStub,
                    "WARNING: Can not kill WebDriver process: failed to delete partial session",
                );
                assert.equal(signalHandler.listenerCount("exit"), exitListenerCount);
            });
        });

        describe("should use local grid url", () => {
            it("should pass browser download mirrors to webdriver pool and browser installer", async () => {
                const browserDownloadMirrors = {
                    chrome: "https://mirror.example/chrome",
                    chromium: null,
                    firefox: null,
                    geckodriver: null,
                };
                const wdPool = mkWdPool_({ gridUrl: "http://localhost:12345/" });
                const config = Object.assign(
                    createBrowserConfig_({
                        gridUrl: "local",
                        desiredCapabilities: {
                            browserName: "chrome",
                            browserVersion: "115.0",
                        },
                    }),
                    {
                        browserDownloadMirrors: {
                            ...browserDownloadMirrors,
                            chrome: "https://mirror.example/old-chrome",
                        },
                    },
                );
                const browser = NewBrowser.create(config, { id: "chrome", wdPool });
                config.browserDownloadMirrors = browserDownloadMirrors;

                await browser.init();

                assert.calledOnceWith(wdPool.getWebdriver, "chrome", "115.0", {
                    debug: true,
                    browserDownloadMirrors,
                });
                assert.calledOnceWith(installBrowserStub, "chrome", "115.0", {
                    shouldInstallWebDriver: false,
                    shouldInstallUbuntuPackages: true,
                    browserDownloadMirrors,
                });
            });

            it("should clean up webdriver and exit handler if mirrored browser installation fails", async () => {
                const initError = new Error("mirror artifact is unavailable");
                const browserDownloadMirrors = {
                    chrome: "https://mirror.example/chrome",
                    chromium: null,
                    firefox: null,
                    geckodriver: null,
                };
                const wdProcess = {
                    gridUrl: "http://localhost:12345/",
                    free: sandbox.stub(),
                    kill: sandbox.stub(),
                    getPid: sandbox.stub().returns(12345),
                };
                const wdPool = { getWebdriver: sandbox.stub().resolves(wdProcess) };
                const config = Object.assign(
                    createBrowserConfig_({
                        gridUrl: "local",
                        desiredCapabilities: {
                            browserName: "chrome",
                            browserVersion: "115.0",
                        },
                    }),
                    { browserDownloadMirrors },
                );
                installBrowserStub.rejects(initError);
                const exitListenerCount = signalHandler.listenerCount("exit");
                const browser = NewBrowser.create(config, { id: "chrome", wdPool });

                const error = await browser.init().catch((error: Error) => error);

                assert.strictEqual(error, initError);
                assert.calledOnceWith(wdPool.getWebdriver, "chrome", "115.0", {
                    debug: true,
                    browserDownloadMirrors,
                });
                assert.calledOnceWith(installBrowserStub, "chrome", "115.0", {
                    shouldInstallWebDriver: false,
                    shouldInstallUbuntuPackages: true,
                    browserDownloadMirrors,
                });
                assert.notCalled(webdriverioRemoteStub);
                assert.notCalled(wdProcess.free);
                assert.calledOnce(wdProcess.kill);
                assert.isUndefined(browser.getDriverPid());
                assert.equal(signalHandler.listenerCount("exit"), exitListenerCount);
            });

            it("if gridUrl is 'local'", async () => {
                installBrowserStub.withArgs("chrome", "115.0").resolves("/browser/path/chrome/115.0");
                (RuntimeConfig.getInstance as SinonStub).returns({ local: false });
                const wdPool = mkWdPool_({ gridUrl: "http://localhost:12345/" });
                const browser = mkBrowser_(
                    {
                        gridUrl: "local",
                        automationProtocol: "webdriver",
                        desiredCapabilities: {
                            browserName: "chrome",
                            browserVersion: "115.0",
                        },
                    },
                    { wdPool },
                );

                await browser.init();

                assert.calledWithMatch(webdriverioRemoteStub, {
                    protocol: "http",
                    hostname: "localhost",
                    port: 12345,
                    path: "/",
                    capabilities: {
                        browserName: "chrome",
                        browserVersion: "115.0",
                        "goog:chromeOptions": {
                            binary: "/browser/path/chrome/115.0",
                        },
                    },
                });
            });

            it("if local cli arg is set", async () => {
                installBrowserStub.withArgs("chrome", "115.0").resolves("/browser/path/chrome/115.0");
                (RuntimeConfig.getInstance as SinonStub).returns({ local: true });
                const wdPool = mkWdPool_({ gridUrl: "http://localhost:12345/" });
                const browser = mkBrowser_(
                    {
                        gridUrl: "http://localhost:4444/wd/hub",
                        automationProtocol: "webdriver",
                        desiredCapabilities: {
                            browserName: "chrome",
                            browserVersion: "115.0",
                        },
                    },
                    { wdPool },
                );

                await browser.init();

                assert.calledWithMatch(webdriverioRemoteStub, {
                    protocol: "http",
                    hostname: "localhost",
                    port: 12345,
                    path: "/",
                    capabilities: {
                        browserName: "chrome",
                        browserVersion: "115.0",
                        "goog:chromeOptions": {
                            binary: "/browser/path/chrome/115.0",
                        },
                    },
                });
            });

            it("should remove unknown capabilities", async () => {
                installBrowserStub.withArgs("chrome", "115.0").resolves("/browser/path/chrome/115.0");
                (RuntimeConfig.getInstance as SinonStub).returns({ local: true });
                const wdPool = mkWdPool_({ gridUrl: "http://localhost:23456/" });
                const browser = mkBrowser_(
                    {
                        gridUrl: "http://localhost:4444/wd/hub",
                        automationProtocol: "webdriver",
                        desiredCapabilities: {
                            browserName: "chrome",
                            browserVersion: "115.0",
                            "selenoid:options": { baz: "qux" } as SelenoidOptions,
                            "moz:firefoxOptions": {},
                            perfLoggingPrefs: { foo: "bar" },
                        } as DesiredCapabilities,
                    },
                    { wdPool },
                );

                await browser.init();

                assert.deepEqual(webdriverioRemoteStub.lastCall.args[0].capabilities, {
                    browserName: "chrome",
                    browserVersion: "115.0",
                    "wdio:enforceWebDriverClassic": true,
                    "goog:chromeOptions": {
                        binary: "/browser/path/chrome/115.0",
                    },
                    perfLoggingPrefs: { foo: "bar" },
                });
            });
        });
    });

    describe("Docker browsers", () => {
        const config = {
            gridUrl: "docker",
            docker: { image: "registry/browser:1", path: "/", port: "4444" },
            desiredCapabilities: { browserName: "chrome", browserVersion: "109.0" },
        };

        it("should prepare CDP using the debugger address returned by Chrome", async () => {
            session.capabilities = { "goog:chromeOptions": { debuggerAddress: "localhost:39599" } };
            session.sessionId = "chrome-session";
            const browser = await mkBrowser_(config).init();
            const driver = await runDockerBrowserStub();
            assert.calledOnceWith(driver.startCdpProxy, "chrome-session", "localhost:39599");
            assert.callOrder(webdriverioRemoteStub, driver.startCdpProxy);
            await browser.quit();
        });

        it("should not start a CDP proxy for a session without a Chrome debugger address", async () => {
            const browser = await mkBrowser_(config).init();
            const driver = await runDockerBrowserStub();
            assert.notCalled(driver.startCdpProxy);
            await browser.quit();
        });

        it("should collect logs and clean up when CDP proxy startup fails", async () => {
            session.capabilities = { "goog:chromeOptions": { debuggerAddress: "localhost:39599" } };
            const driver = await runDockerBrowserStub();
            driver.startCdpProxy.rejects(new Error("CDP proxy failed"));
            await assert.isRejected(mkBrowser_(config).init(), "CDP proxy failed");
            assert.callOrder(driver.startCdpProxy, driver.getLogs, driver.kill);
            assert.calledOnceWith(driver.saveLogs, session.sessionId);
            assert.callOrder(driver.saveLogs, driver.kill);
        });

        it("should save session logs before deleting the browser and print their path", async () => {
            const browser = await mkBrowser_(config).init();
            const driver = await runDockerBrowserStub();
            await Promise.all([browser.quit(), browser.quit()]);
            assert.calledOnceWith(driver.saveLogs, session.sessionId);
            assert.callOrder(driver.saveLogs, session.deleteSession, driver.free);
            assert.calledWith(logStub, "Docker session log: /tmp/testplane-logs/1234567890.log");
        });

        it("should save logs before killing a broken session", async () => {
            const browser = await mkBrowser_(config).init();
            const driver = await runDockerBrowserStub();
            session.deleteSession.rejects(new Error("connection lost"));
            await browser.kill();
            assert.callOrder(driver.saveLogs, session.deleteSession, driver.kill);
        });

        it("should warn and still delete the session when saving logs fails", async () => {
            const browser = await mkBrowser_(config).init();
            const driver = await runDockerBrowserStub();
            driver.saveLogs.rejects(new Error("disk full"));
            await browser.quit();
            assert.calledOnce(session.deleteSession);
            assert.calledOnce(driver.free);
            assert.calledWith(warnStub, "WARNING: Cannot save Docker session log: disk full");
        });

        it("should connect to the container without installing a browser on the host", async () => {
            const browser = await mkBrowser_(config).init();

            assert.calledOnceWith(runDockerBrowserStub, config.docker, {
                browserName: "chrome",
                browserVersion: "1.0",
                timeout: 3000,
            });
            assert.notCalled(installBrowserStub);
            assert.calledWithMatch(webdriverioRemoteStub, {
                hostname: "127.0.0.1",
                port: 23456,
                path: "/wd/hub",
                capabilities: { browserName: "chrome" },
            });
            assert.notProperty(webdriverioRemoteStub.firstCall.args[0].capabilities, "goog:chromeOptions");
            await browser.quit();
        });

        ["appium:deviceName", "deviceName"].forEach(deviceNameKey => {
            it(`should route an Appium session using ${deviceNameKey} without changing its capabilities`, async () => {
                const docker = { image: "registry/android:searchapp", path: "/wd/hub", port: "4723" };
                const desiredCapabilities = {
                    [deviceNameKey]: "android-phone",
                    browserVersion: "searchapp-26.06.6.00",
                };
                const browser = await mkBrowser_(
                    { gridUrl: "docker", docker, desiredCapabilities },
                    { id: "android", version: "searchapp-26.06.6.00", state: {} },
                ).init();

                assert.calledOnceWith(runDockerBrowserStub, docker, {
                    browserName: "android-phone",
                    browserVersion: "searchapp-26.06.6.00",
                    timeout: 3000,
                });
                const options = webdriverioRemoteStub.firstCall.args[0];
                assert.equal(options.port, 23456);
                assert.include(options.capabilities, desiredCapabilities);
                assert.notProperty(options.capabilities, "browserName");
                await browser.quit();
            });
        });

        it("should prefer browserName over an Appium device name for Selenoid routing", async () => {
            const browser = await mkBrowser_({
                ...config,
                desiredCapabilities: { ...config.desiredCapabilities, "appium:deviceName": "android-phone" },
            }).init();

            assert.calledWithMatch(runDockerBrowserStub, config.docker, { browserName: "chrome" });
            await browser.quit();
        });

        it("should use sessionRequestTimeout for container startup", async () => {
            const browser = await mkBrowser_({ ...config, sessionRequestTimeout: 60000 }).init();
            assert.calledOnceWith(runDockerBrowserStub, config.docker, {
                browserName: "chrome",
                browserVersion: "1.0",
                timeout: 60000,
            });
            await browser.quit();
        });

        it("should await container removal on quit", async () => {
            const driver = await runDockerBrowserStub();
            let removed = false;
            driver.free.callsFake(async () => {
                await Promise.resolve();
                removed = true;
            });
            const browser = await mkBrowser_(config).init();
            await browser.quit();
            assert.isTrue(removed);
            assert.calledOnce(driver.free);
        });

        it("should remove the container when session creation fails", async () => {
            const driver = await runDockerBrowserStub();
            webdriverioRemoteStub.rejects(new Error("session not created"));
            await assert.isRejected(mkBrowser_(config).init(), "session not created");
            assert.calledOnce(driver.kill);
            assert.notCalled(driver.saveLogs);
        });

        it("should save logs once and kill the container when kill interrupts pending quit cleanup", async () => {
            const driver = await runDockerBrowserStub();
            let finishSaving: (file: string) => void;
            driver.saveLogs.returns(new Promise<string>(resolve => (finishSaving = resolve)));
            const browser = await mkBrowser_(config).init();

            const quitPromise = browser.quit();
            await Promise.resolve();
            const killPromise = browser.kill();

            assert.calledOnce(driver.saveLogs);
            assert.notCalled(session.deleteSession);
            finishSaving!("/tmp/testplane-logs/1234567890.log");
            await Promise.all([quitPromise, killPromise]);

            assert.calledOnce(session.deleteSession);
            assert.calledOnce(driver.kill);
            assert.notCalled(driver.free);
            assert.callOrder(driver.saveLogs, session.deleteSession, driver.kill);
        });

        it("should kill the container if releasing it fails", async () => {
            const driver = await runDockerBrowserStub();
            driver.free.rejects(new Error("release failed"));
            const browser = await mkBrowser_(config).init();

            await browser.quit();

            assert.calledOnce(driver.kill);
            assert.callOrder(driver.free, driver.kill);
            assert.calledWith(warnStub, "WARNING: Can not free WebDriver process: release failed");
        });

        it("should append Selenoid logs before removing a failed session's environment", async () => {
            const driver = await runDockerBrowserStub();
            driver.getLogs.resolves("Chrome startup failed");
            const error = new Error("session not created");
            webdriverioRemoteStub.rejects(error);
            await assert.isRejected(
                mkBrowser_(config).init(),
                "Selenoid logs (registry/browser:1):\nChrome startup failed",
            );
            assert.callOrder(driver.getLogs, driver.kill);
            assert.equal(error.stack!.split("Selenoid logs").length, 2);
        });

        it("should preserve the session error and clean up if reading logs fails", async () => {
            const driver = await runDockerBrowserStub();
            driver.getLogs.rejects(new Error("logs unavailable"));
            webdriverioRemoteStub.rejects(new Error("session not created"));
            await assert.isRejected(mkBrowser_(config).init(), "session not created");
            assert.calledOnce(driver.kill);
        });

        it("should remove the container even when deleting the session fails", async () => {
            const driver = await runDockerBrowserStub();
            const browser = await mkBrowser_(config).init();
            session.deleteSession.rejects(new Error("connection lost"));
            await browser.kill();
            assert.calledOnce(driver.kill);
        });

        it("should remove the container on interruption", async () => {
            const driver = await runDockerBrowserStub();
            await mkBrowser_(config).init();
            await signalHandler.emitAndWait("exit");
            assert.calledOnce(driver.free);
            assert.callOrder(driver.saveLogs, session.deleteSession, driver.free);
        });

        it("should preserve the original session error if container removal also fails", async () => {
            const driver = await runDockerBrowserStub();
            driver.kill.rejects(new Error("cleanup failed"));
            webdriverioRemoteStub.rejects(new Error("session not created"));
            await assert.isRejected(mkBrowser_(config).init(), "session not created");
            assert.calledWith(warnStub, "WARNING: Can not remove Docker container: cleanup failed");
        });

        it("should let --local override Docker just like a remote grid", async () => {
            (RuntimeConfig.getInstance as SinonStub).returns({ local: true });
            const browser = await mkBrowser_(config).init();
            assert.notCalled(runDockerBrowserStub);
            assert.called(installBrowserStub);
            await browser.quit();
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

        it("should finalize webdriver.io session only once", async () => {
            const browser = await mkBrowser_().init();
            const error = new Error("Tests were stopped by the user");

            await Promise.all([browser.quit(error), browser.quit(error)]);

            assert.calledOnce(session.deleteSession);
            assert.strictEqual(browser.exitError, error);
        });

        it("should preserve session metadata after cleanup", async () => {
            session.sessionId = "session-id";
            const browser = await mkBrowser_().init();

            await browser.quit();

            assert.equal(browser.sessionId, "session-id");
            assert.strictEqual(browser.publicAPI, session);
        });

        it("should wait for session creation before finalizing it", async () => {
            let resolveSession: (browserSession: unknown) => void;
            webdriverioRemoteStub.returns(new Promise(resolve => (resolveSession = resolve)));
            const browser = mkBrowser_();
            const initPromise = browser.init();
            const quitPromise = browser.quit(new Error("Tests were stopped by the user"));

            assert.notCalled(session.deleteSession);
            resolveSession!(session);
            await Promise.all([initPromise, quitPromise]);

            assert.calledOnce(session.deleteSession);
        });

        it("should finalize session on global exit event", async () => {
            await mkBrowser_().init();

            await signalHandler.emitAndWait("exit");

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

        it("should free webdriver session", async () => {
            (RuntimeConfig.getInstance as SinonStub).returns({ local: false });
            const wdProcess = { gridUrl: "http://localhost:12345", free: sandbox.stub(), kill: sandbox.stub() };
            const wdPool = { getWebdriver: sandbox.stub().resolves(wdProcess) };
            const browser = mkBrowser_(
                {
                    gridUrl: "local",
                    automationProtocol: "webdriver",
                    desiredCapabilities: {
                        browserName: "chrome",
                        browserVersion: "115.0",
                    },
                },
                { wdPool },
            );

            await browser.init();

            await browser.quit();

            assert.notCalled(wdProcess.kill);
            assert.calledOnce(wdProcess.free);
        });

        it("should kill webdriver session if cant quit normally", async () => {
            (RuntimeConfig.getInstance as SinonStub).returns({ local: false });
            session.deleteSession.rejects(new Error("failed end"));
            const wdProcess = {
                gridUrl: "http://localhost:12345",
                free: sandbox.stub(),
                kill: sandbox.stub(),
                getPid: sandbox.stub().returns(12345),
            };
            const wdPool = { getWebdriver: sandbox.stub().resolves(wdProcess) };
            const exitListenerCount = signalHandler.listenerCount("exit");
            const browser = mkBrowser_(
                {
                    gridUrl: "local",
                    automationProtocol: "webdriver",
                    desiredCapabilities: {
                        browserName: "chrome",
                        browserVersion: "115.0",
                    },
                },
                { wdPool },
            );

            await browser.init();

            await browser.quit();

            assert.notCalled(wdProcess.free);
            assert.calledOnce(wdProcess.kill);
            assert.isUndefined(browser.getDriverPid());
            assert.equal(signalHandler.listenerCount("exit"), exitListenerCount);

            await browser.quit();

            assert.calledOnce(wdProcess.kill);
        });

        [null, undefined].forEach(deleteError => {
            it(`should kill webdriver if session deletion rejects with ${String(deleteError)}`, async () => {
                (RuntimeConfig.getInstance as SinonStub).returns({ local: false });
                session.deleteSession.callsFake(() => Promise.reject(deleteError));
                const wdProcess = {
                    gridUrl: "http://localhost:12345",
                    free: sandbox.stub(),
                    kill: sandbox.stub(),
                    getPid: sandbox.stub().returns(12345),
                };
                const wdPool = { getWebdriver: sandbox.stub().resolves(wdProcess) };
                const browser = mkBrowser_(
                    {
                        gridUrl: "local",
                        automationProtocol: "webdriver",
                        desiredCapabilities: {
                            browserName: "chrome",
                            browserVersion: "115.0",
                        },
                    },
                    { wdPool },
                );

                await browser.init();
                await browser.quit();

                assert.notCalled(wdProcess.free);
                assert.calledOnce(wdProcess.kill);
                assert.calledOnceWith(warnStub, `WARNING: Can not close session: ${String(deleteError)}`);
            });
        });

        it("should kill and clear webdriver process if session does not exist", async () => {
            (RuntimeConfig.getInstance as SinonStub).returns({ local: false });
            const wdProcess = {
                gridUrl: "http://localhost:12345",
                free: sandbox.stub(),
                kill: sandbox.stub(),
                getPid: sandbox.stub().returns(12345),
            };
            const wdPool = { getWebdriver: sandbox.stub().resolves(wdProcess) };
            const exitListenerCount = signalHandler.listenerCount("exit");
            const browser = mkBrowser_(
                {
                    gridUrl: "local",
                    desiredCapabilities: {
                        browserName: "chrome",
                        browserVersion: "115.0",
                    },
                },
                { wdPool },
            );
            await browser._getLocalWebdriverGridUrl();

            await browser.quit();

            assert.notCalled(wdProcess.free);
            assert.calledOnce(wdProcess.kill);
            assert.isUndefined(browser.getDriverPid());
            assert.notCalled(warnStub);
            assert.equal(signalHandler.listenerCount("exit"), exitListenerCount);
        });
    });

    describe("kill", () => {
        it("should kill and clear webdriver process if session deletion fails", async () => {
            const deleteError = new Error("failed end");
            session.deleteSession.rejects(deleteError);
            const wdProcess = {
                gridUrl: "http://localhost:12345",
                free: sandbox.stub(),
                kill: sandbox.stub(),
                getPid: sandbox.stub().returns(12345),
            };
            const wdPool = { getWebdriver: sandbox.stub().resolves(wdProcess) };
            const exitListenerCount = signalHandler.listenerCount("exit");
            const browser = mkBrowser_(
                {
                    gridUrl: "local",
                    desiredCapabilities: {
                        browserName: "chrome",
                        browserVersion: "115.0",
                    },
                },
                { wdPool },
            );
            await browser.init();

            await browser.kill();

            assert.calledOnce(session.deleteSession);
            assert.calledOnce(wdProcess.kill);
            assert.isUndefined(browser.getDriverPid());
            assert.calledOnceWith(warnStub, "WARNING: Can not kill WebDriver process: failed end");
            assert.equal(signalHandler.listenerCount("exit"), exitListenerCount);
        });

        it("should kill webdriver.io session only once", async () => {
            const browser = await mkBrowser_().init();

            await browser.kill();
            await browser.kill();

            assert.calledOnce(session.deleteSession);
        });

        it("should escalate pending quit cleanup when kill is called concurrently", async () => {
            let resolveDeleteSession!: () => void;
            session.deleteSession.callsFake(() => new Promise<void>(resolve => (resolveDeleteSession = resolve)));
            const wdProcess = {
                gridUrl: "http://localhost:12345",
                free: sandbox.stub(),
                kill: sandbox.stub(),
                getPid: sandbox.stub().returns(12345),
            };
            const browser = await mkBrowser_().init();
            Reflect.set(browser, "_wdProcess", wdProcess);

            const quitPromise = browser.quit();
            await Promise.resolve();
            const killPromise = browser.kill();

            assert.calledOnce(session.deleteSession);
            resolveDeleteSession();
            await Promise.all([quitPromise, killPromise]);

            assert.calledOnce(session.deleteSession);
            assert.notCalled(wdProcess.free);
            assert.calledOnce(wdProcess.kill);
        });

        it("should let kill own cleanup when quit is called concurrently", async () => {
            let resolveDeleteSession!: () => void;
            session.deleteSession.callsFake(() => new Promise<void>(resolve => (resolveDeleteSession = resolve)));
            const wdProcess = {
                gridUrl: "http://localhost:12345",
                free: sandbox.stub(),
                kill: sandbox.stub(),
                getPid: sandbox.stub().returns(12345),
            };
            const browser = await mkBrowser_().init();
            Reflect.set(browser, "_wdProcess", wdProcess);

            const killPromise = browser.kill();
            const quitPromise = browser.quit();

            assert.calledOnce(session.deleteSession);
            resolveDeleteSession();
            await Promise.all([killPromise, quitPromise]);

            assert.calledOnce(session.deleteSession);
            assert.notCalled(wdProcess.free);
            assert.calledOnce(wdProcess.kill);
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

            assert.called(warnStub);
        });
    });
});
