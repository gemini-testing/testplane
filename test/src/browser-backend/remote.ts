import sinon, { type SinonStub } from "sinon";
import crypto from "crypto";
import proxyquire from "proxyquire";
import type { RequestLibOptions as RequestOptions } from "@testplane/wdio-types/build/Options";
import type { BrowserConfig } from "src/config/browser-config";
import type { RemoteBrowserBackend as RemoteBackend } from "src/browser-backend/remote";
import { WEBDRIVER_PROTOCOL } from "src/constants/config";
import { X_REQUEST_ID_DELIMITER } from "src/constants/browser";
import { withTestContext } from "src/utils/test-context";
import { createBrowserConfig_, mkSessionStub_ } from "../browser/utils";

describe("browser-backend/remote", () => {
    const sandbox = sinon.createSandbox();
    let session: WebdriverIO.Browser;
    let RemoteBrowserBackend: typeof RemoteBackend;
    let webdriverioRemoteStub: SinonStub;
    let warnStub: SinonStub;
    let backends: RemoteBackend[];

    const startSession = (
        configOpts?: Partial<BrowserConfig>,
        opts: { version?: string; id?: string } = {},
    ): Promise<WebdriverIO.Browser> => {
        const config = createBrowserConfig_(configOpts).forBrowser();
        const backend = new RemoteBrowserBackend(config.gridUrl);
        backends.push(backend);

        return backend.startSession(config, { browserVersionOverride: opts.version ?? null });
    };

    beforeEach(() => {
        backends = [];
        session = mkSessionStub_();
        webdriverioRemoteStub = sandbox.stub().resolves(session);
        warnStub = sandbox.stub();
        RemoteBrowserBackend = proxyquire("src/browser-backend/remote", {
            "@testplane/webdriverio": { remote: webdriverioRemoteStub },
            "../../utils/session-opts": proxyquire("src/utils/session-opts", { "./logger": { warn: warnStub } }),
        }).RemoteBrowserBackend;
    });

    afterEach(async () => {
        try {
            await Promise.all(backends.map(backend => backend[Symbol.asyncDispose]()));
        } finally {
            sandbox.restore();
        }
    });

    it("should create session with properties from browser config", async () => {
        await startSession();

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
        await startSession({ gridUrl: "http://some-host/some-path" });

        assert.calledWithMatch(webdriverioRemoteStub, { port: 4444 });
    });

    describe("headless setting", () => {
        describe("chrome", () => {
            it("should generate browser specific settings", async () => {
                await startSession({
                    headless: true,
                    desiredCapabilities: { browserName: "chrome" },
                });

                assert.calledWithMatch(webdriverioRemoteStub, {
                    capabilities: {
                        browserName: "chrome",
                        "goog:chromeOptions": { args: ["headless", "disable-gpu"] },
                    },
                });
            });

            it("should add passed value to args if string was passed", async () => {
                await startSession({
                    headless: "new",
                    desiredCapabilities: { browserName: "chrome" },
                });

                assert.calledWithMatch(webdriverioRemoteStub, {
                    capabilities: {
                        browserName: "chrome",
                        "goog:chromeOptions": { args: ["headless=new", "disable-gpu"] },
                    },
                });
            });
        });

        it("should generate browser specific settings - firefox", async () => {
            await startSession({
                headless: true,
                desiredCapabilities: { browserName: "firefox" },
            });

            assert.calledWithMatch(webdriverioRemoteStub, {
                capabilities: {
                    browserName: "firefox",
                    "moz:firefoxOptions": { args: ["-headless"] },
                },
            });
        });

        it("should generate browser specific settings - edge", async () => {
            await startSession({
                headless: true,
                desiredCapabilities: { browserName: "msedge" },
            });

            assert.calledWithMatch(webdriverioRemoteStub, {
                capabilities: { browserName: "msedge", "ms:edgeOptions": { args: ["--headless"] } },
            });
        });

        it("not override existing settings", async () => {
            await startSession({
                headless: true,
                desiredCapabilities: {
                    browserName: "chrome",
                    "goog:chromeOptions": { args: ["my", "custom", "flags"] },
                },
            });

            assert.calledWithMatch(webdriverioRemoteStub, {
                capabilities: {
                    browserName: "chrome",
                    "goog:chromeOptions": { args: ["my", "custom", "flags", "headless", "disable-gpu"] },
                },
            });
        });

        it("should issue a warning for an unsupported browser", async () => {
            await startSession({
                headless: true,
                desiredCapabilities: { browserName: "safari" },
            });

            assert.calledOnceWith(warnStub, "WARNING: Headless setting is not supported for safari browserName");
        });
    });

    describe('should create session with extended "browserVersion" in desiredCapabilities if', () => {
        it("it is already exists in capabilities", async () => {
            await startSession(
                { desiredCapabilities: { browserName: "browser", browserVersion: "1.0" } },
                { id: "browser", version: "2.0" },
            );

            assert.calledWithMatch(webdriverioRemoteStub, {
                capabilities: { browserName: "browser", browserVersion: "2.0" },
            });
        });

        it("w3c protocol is used", async () => {
            await startSession({ sessionEnvFlags: { isW3C: true } }, { id: "browser", version: "2.0" });

            assert.calledWithMatch(webdriverioRemoteStub, {
                capabilities: { browserName: "browser", browserVersion: "2.0" },
            });
        });
    });

    describe('should create session with extended "wdio:enforceWebDriverClassic"', () => {
        it('should set capability if "webSocketUrl" is not set by user', async () => {
            const desiredCapabilities = { browserName: "chrome" };

            await startSession({ desiredCapabilities });

            assert.calledWithMatch(webdriverioRemoteStub, {
                capabilities: { ...desiredCapabilities, "wdio:enforceWebDriverClassic": true },
            });
        });

        describe("should not set capability if", () => {
            it('"webSocketUrl" set by user', async () => {
                const desiredCapabilities = { browserName: "chrome", webSocketUrl: true };

                await startSession({ desiredCapabilities });

                assert.calledWithMatch(webdriverioRemoteStub, {
                    capabilities: desiredCapabilities,
                });
            });

            it('"wdio:enforceWebDriverClassic" set by user', async () => {
                const desiredCapabilities = { browserName: "chrome", "wdio:enforceWebDriverClassic": false };

                await startSession({ desiredCapabilities });

                assert.calledWithMatch(webdriverioRemoteStub, {
                    capabilities: desiredCapabilities,
                });
            });
        });
    });

    it("should use session request timeout for create a session", async () => {
        await startSession({ sessionRequestTimeout: 100500, httpTimeout: 500100 });

        assert.calledWithMatch(webdriverioRemoteStub, { connectionRetryTimeout: 100500 });
    });

    it("should use http timeout for create a session if session request timeout not set", async () => {
        await startSession({ sessionRequestTimeout: null, httpTimeout: 500100 });

        assert.calledWithMatch(webdriverioRemoteStub, { connectionRetryTimeout: 500100 });
    });

    describe("transformRequest option", () => {
        beforeEach(() => {
            sandbox.stub(crypto, "randomUUID").returns("0-0-0-0-0");
        });

        it("should call user handler from config", async () => {
            const request = { headers: {} };
            const transformRequestStub = sandbox.stub().returns(request);

            await startSession({ transformRequest: transformRequestStub });

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

            await startSession({ transformRequest: transformRequestStub });

            const { transformRequest } = webdriverioRemoteStub.lastCall.args[0];
            transformRequest(request);

            assert.equal((request.headers as Record<string, string>)["X-Request-ID"], "100500");
        });

        it('should add "X-Request-ID" header', async () => {
            (crypto.randomUUID as SinonStub).returns("67890");
            const context = { testXReqId: "12345", traceparent: "" };
            const request: RequestOptions = { headers: {} };

            await startSession();

            const { transformRequest } = webdriverioRemoteStub.lastCall.args[0];
            withTestContext(context, () => transformRequest(request));

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

            await startSession({ transformResponse: transformResponseStub });

            const { transformResponse } = webdriverioRemoteStub.lastCall.args[0];
            transformResponse(response);

            assert.calledOnceWith(transformResponseStub, response);
        });
    });
});
