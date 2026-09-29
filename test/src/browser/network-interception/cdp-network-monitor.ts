import sinon from "sinon";
import { CDP } from "src/browser/cdp";
import { CdpNetworkMonitor } from "src/browser/network-interception/cdp-network-monitor";
import type { NetworkRequest, NetworkResponse } from "src/browser/network-interception/types";
import type { CDPTargetInfo } from "src/browser/cdp/types";

const sessionId = "monitor-session";
const browserSessionId = "monitor-browser";

describe("CDP network monitor", () => {
    const sandbox = sinon.createSandbox();
    let command: sinon.SinonStub;
    let cdp: CDP;
    let session: WebdriverIO.Browser;
    let monitor: CdpNetworkMonitor;
    let requests: NetworkRequest[];
    let responses: NetworkResponse[];
    let finished: sinon.SinonSpy;
    let failed: sinon.SinonSpy;
    let targets: CDPTargetInfo[];

    const target = (
        targetId: string,
        type: CDPTargetInfo["type"] = "page",
        browserContextId = "context",
    ): CDPTargetInfo => ({
        targetId,
        type,
        browserContextId,
        url: "about:blank",
        title: "",
        attached: false,
    });
    const attach = (id: string, targetInfo: CDPTargetInfo, parentId = browserSessionId): void => {
        cdp.target.emit("attachedToTarget", { sessionId: id, targetInfo, waitingForDebugger: true }, parentId);
    };
    const detached = (id: string): void => {
        cdp.target.emit("detachedFromTarget", { sessionId: id }, browserSessionId);
    };
    const flushAttachments = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

    const request = (overrides = {}, event = {}, fromSession = sessionId): void => {
        cdp.network.emit(
            "requestWillBeSent",
            {
                requestId: "request",
                loaderId: "",
                timestamp: 10,
                wallTime: 100,
                request: {
                    url: "https://example.com/api",
                    method: "POST",
                    headers: { "Content-Type": "text/plain" },
                    ...overrides,
                },
                ...event,
            },
            fromSession,
        );
    };
    const response = (overrides = {}, fromSession = sessionId): void => {
        cdp.network.emit(
            "responseReceived",
            {
                requestId: "request",
                timestamp: 10.25,
                response: { status: 200, statusText: "OK", headers: {}, ...overrides },
            },
            fromSession,
        );
    };
    const finish = (fromSession = sessionId): void => {
        cdp.network.emit("loadingFinished", { requestId: "request", timestamp: 10.5 }, fromSession);
    };

    beforeEach(() => {
        command = sandbox.stub().resolves({});
        targets = [target("page")];
        command.withArgs("Target.getTargets").callsFake(async () => ({ targetInfos: targets }));
        command.withArgs("Target.attachToBrowserTarget").resolves({ sessionId: browserSessionId });
        command.withArgs("Target.setAutoAttach").callsFake(async (_method, options) => {
            if (options.sessionId === browserSessionId) {
                for (const info of targets) {
                    attach(info.targetId === "page" ? sessionId : `session-${info.targetId}`, info);
                }
            }
        });
        command.withArgs("Network.getRequestPostData").resolves({ postData: "post body" });
        command.withArgs("Network.getResponseBody").resolves({ body: "response body", base64Encoded: false });
        cdp = new CDP({ request: command } as never);
        session = {
            getWindowHandles: sandbox.stub().resolves(["CDwindow-page"]),
        } as never;
        monitor = new CdpNetworkMonitor(cdp, session);
        requests = [];
        responses = [];
        finished = sandbox.spy();
        failed = sandbox.spy();
        monitor.on("request", value => requests.push(value));
        monitor.on("response", value => responses.push(value));
        monitor.on("requestfinished", finished);
        monitor.on("requestfailed", failed);
    });

    afterEach(async () => {
        await monitor.stop();
        sandbox.restore();
    });

    it("should expose request metadata and read the response only after completion", async () => {
        const bytes = Buffer.from([0, 255, 128]);
        command.withArgs("Network.getResponseBody").resolves({ body: bytes.toString("base64"), base64Encoded: true });
        await monitor.start();

        request({ hasPostData: true });
        response({ headers: { "Set-Cookie": "a=1\nb=2" } });
        const body = responses[0].body();
        finish();
        const [postData, responseData] = await Promise.all([requests[0].body(), body]);

        assert.include(requests[0], { url: "https://example.com/api", method: "POST", timestamp: 100000 });
        assert.include(responses[0], { request: requests[0], status: 200, timestamp: 100250 });
        assert.deepEqual(responses[0].headers, [
            { name: "set-cookie", value: "a=1" },
            { name: "set-cookie", value: "b=2" },
        ]);
        assert.deepEqual([postData, responseData], [Buffer.from("post body"), bytes]);
        assert.calledOnceWithExactly(finished, requests[0], 100500);
        assert.callOrder(finished, command.withArgs("Network.getResponseBody"));
    });

    it("should keep redirect hops separate when CDP reuses the request id", async () => {
        await monitor.start();

        request({ hasPostData: true });
        request(
            { url: "https://example.com/redirected", method: "GET" },
            {
                redirectResponse: { status: 302, statusText: "Found", headers: { location: "/redirected" } },
            },
        );
        response();
        finish();

        assert.deepEqual(
            responses.map(res => [res.request.url, res.status]),
            [
                ["https://example.com/api", 302],
                ["https://example.com/redirected", 200],
            ],
        );
        await assert.isRejected(requests[0].body(), /no longer available/);
        await assert.isRejected(responses[0].body(), /redirects/);
        assert.deepEqual(await responses[1].body(), Buffer.from("response body"));
        assert.calledTwice(finished);
    });

    it("should preserve raw request bytes and reject incomplete multipart bodies", async () => {
        await monitor.start();

        request({ postData: "lossy", postDataEntries: [{ bytes: "AID/" }, { bytes: "Kg==" }] });
        request({ postData: "partial", postDataEntries: [{ bytes: "aGk=" }, {}] }, { requestId: "multipart" });

        assert.deepEqual(await requests[0].body(), Buffer.from([0, 128, 255, 42]));
        await assert.isRejected(requests[1].body(), /unavailable data/);
    });

    it("should report a failed download and reject its pending body", async () => {
        await monitor.start();
        request();
        response();
        const body = responses[0].body();

        cdp.network.emit(
            "loadingFailed",
            { requestId: "request", timestamp: 10.3, errorText: "net::ERR_ABORTED" },
            sessionId,
        );

        await assert.isRejected(body, /net::ERR_ABORTED/);
        assert.calledOnceWithExactly(failed, requests[0], 100300, "net::ERR_ABORTED");
        assert.notCalled(command.withArgs("Network.getResponseBody"));
    });

    it("should settle incomplete bodies and remove listeners when stopped", async () => {
        await monitor.start();
        request();
        response();
        const body = responses[0].body();

        await monitor.stop();
        await monitor.stop();

        await assert.isRejected(body, /stopped before/);
        assert.isEmpty(cdp.network.eventNames());
        assert.calledOnceWithExactly(command.withArgs("Target.detachFromTarget"), "Target.detachFromTarget", {
            sessionId: undefined,
            params: { sessionId: browserSessionId },
        });
    });

    it("should wait for an ongoing body read before detaching", async () => {
        let complete!: sinon.SinonSpy;
        command.withArgs("Network.getResponseBody").returns(
            new Promise(resolve => {
                complete = sandbox.spy(resolve);
            }),
        );
        await monitor.start();
        request();
        response();
        const body = responses[0].body();
        finish();

        const stopped = monitor.stop();
        await flushAttachments();
        complete({ body: "done", base64Encoded: false });
        await stopped;

        assert.deepEqual(await body, Buffer.from("done"));
        assert.callOrder(complete, command.withArgs("Target.detachFromTarget"));
    });

    it("should drain queued response events before stopping", async () => {
        await monitor.start();
        request();
        monitor.on("response", value => {
            void value.body();
        });
        command.withArgs("Runtime.evaluate").callsFake(async () => {
            response();
            finish();
            return {};
        });

        await monitor.stop();

        assert.lengthOf(responses, 1);
        assert.deepEqual(await responses[0].body(), Buffer.from("response body"));
        assert.callOrder(command.withArgs("Network.getResponseBody"), command.withArgs("Target.detachFromTarget"));
    });

    it("should clean up after Network.enable fails", async () => {
        command.withArgs("Network.enable").rejects(new Error("enable failed"));

        const started = monitor.start();

        await assert.isRejected(started, /enable failed/);
        assert.isEmpty(cdp.network.eventNames());
        assert.calledTwice(command.withArgs("Target.detachFromTarget"));
        assert.calledWithExactly(command, "Runtime.runIfWaitingForDebugger", { sessionId });
        assert.isEmpty(cdp.target.eventNames());
    });

    it("should refuse to record an arbitrary target if the current window is missing", async () => {
        command.withArgs("Target.getTargets").resolves({ targetInfos: [{ targetId: "unrelated-page", type: "page" }] });

        const started = monitor.start();

        await assert.isRejected(started, /Could not find/);
        assert.notCalled(command.withArgs("Target.attachToBrowserTarget"));
    });

    it("should isolate tabs with reused request ids and exclude unrelated browser contexts", async () => {
        targets.push(target("second"), target("unrelated", "page", "other-context"));
        (session.getWindowHandles as sinon.SinonStub).resolves(["CDwindow-page", "second"]);
        await monitor.start();

        request();
        request({ url: "https://example.com/second" }, {}, "session-second");
        request({}, {}, "session-unrelated");
        response();
        response({}, "session-second");
        finish();
        finish("session-second");
        await Promise.all(responses.map(res => res.body()));

        assert.deepEqual(
            responses.map(res => res.request),
            requests,
        );
        assert.lengthOf(requests, 2);
        assert.calledWithExactly(command, "Network.getResponseBody", {
            sessionId: "session-second",
            params: { requestId: "request" },
        });
        assert.calledWithExactly(command, "Runtime.runIfWaitingForDebugger", { sessionId: "session-unrelated" });
        assert.calledWithExactly(command, "Target.detachFromTarget", {
            sessionId: browserSessionId,
            params: { sessionId: "session-unrelated" },
        });
    });

    it("should enable monitoring before resuming a popup without an opener", async () => {
        await monitor.start();
        let enable!: () => void;
        command.withArgs("Network.enable", { sessionId: "popup-session", params: undefined }).returns(
            new Promise<void>(resolve => {
                enable = resolve;
            }),
        );
        command.withArgs("Runtime.runIfWaitingForDebugger", { sessionId: "popup-session" }).callsFake(async () => {
            enable();
            request({ url: "https://example.com/popup" }, {}, "popup-session");
            response({}, "popup-session");
            finish("popup-session");
        });

        attach("popup-session", target("popup"));
        await flushAttachments();

        assert.lengthOf(requests, 1);
        assert.deepEqual(await responses[0].body(), Buffer.from("response body"));
        assert.callOrder(
            command.withArgs("Network.enable", { sessionId: "popup-session", params: undefined }),
            command.withArgs("Runtime.runIfWaitingForDebugger", { sessionId: "popup-session" }),
        );
    });

    it("should observe same-process frames and recursively attach to out-of-process frames", async () => {
        await monitor.start();
        request({}, { frameId: "local-frame" });
        finish();
        attach("frame-session", target("frame", "iframe"), sessionId);
        await flushAttachments();
        attach("nested-session", target("nested", "iframe"), "frame-session");
        await flushAttachments();
        request({ url: "https://other.example/frame" }, {}, "frame-session");
        finish("frame-session");
        request({ url: "https://third.example/nested" }, {}, "nested-session");
        response({}, "nested-session");
        finish("nested-session");

        assert.lengthOf(requests, 3);
        assert.calledThrice(finished);
        assert.deepEqual(await responses[0].body(), Buffer.from("response body"));
        assert.calledWithExactly(command, "Network.getResponseBody", {
            sessionId: "nested-session",
            params: { requestId: "request" },
        });
    });

    it("should correlate iframe navigation across sessions and fetch its body from the finishing session", async () => {
        await monitor.start();
        request({}, { loaderId: "request", frameId: "frame" });
        response();
        const body = responses[0].body();
        attach("frame-session", target("frame", "iframe"), sessionId);
        await flushAttachments();
        request({}, { loaderId: "request", frameId: "frame" }, "frame-session");
        response({}, "frame-session");
        finish("frame-session");

        assert.deepEqual(await body, Buffer.from("response body"));
        assert.lengthOf(requests, 1);
        assert.lengthOf(responses, 1);
        assert.calledOnce(finished);
        assert.calledOnceWithExactly(command.withArgs("Network.getResponseBody"), "Network.getResponseBody", {
            sessionId: "frame-session",
            params: { requestId: "request" },
        });
    });

    it("should preserve a navigation when iframe detachment arrives before the process swap", async () => {
        await monitor.start();
        attach("frame-session", target("frame", "iframe"), sessionId);
        await flushAttachments();
        request({}, { loaderId: "request", frameId: "frame" }, "frame-session");
        response({}, "frame-session");
        const body = responses[0].body();
        command.withArgs("Page.enable", { sessionId }).callsFake(async () => {
            cdp.page.emit("frameAttached", { frameId: "frame", parentFrameId: "page" }, sessionId);
        });

        detached("frame-session");
        await flushAttachments();
        finish();

        assert.deepEqual(await body, Buffer.from("response body"));
        assert.calledOnceWithExactly(command.withArgs("Network.getResponseBody"), "Network.getResponseBody", {
            sessionId,
            params: { requestId: "request" },
        });
    });

    it("should cancel a child frame body read when its page closes", async () => {
        command.withArgs("Network.getResponseBody").returns(new Promise(() => {}));
        await monitor.start();
        attach("frame-session", target("frame", "iframe"), sessionId);
        await flushAttachments();
        request({}, {}, "frame-session");
        response({}, "frame-session");
        finish("frame-session");
        const body = responses[0].body();
        await Promise.resolve();

        detached(sessionId);
        await monitor.stop();

        await assert.isRejected(body, /no longer available/);
        assert.isEmpty(cdp.network.eventNames());
    });

    describe("body size limit", () => {
        beforeEach(async () => {
            monitor = new CdpNetworkMonitor(cdp, session, 3);
            monitor.on("request", value => requests.push(value));
            monitor.on("response", value => responses.push(value));
            await monitor.start();
        });

        it("should limit decoded bytes, including UTF-8 and multipart request data", async () => {
            request({ postData: "éé" });
            request({ postDataEntries: [{ bytes: "AQI=" }, { bytes: "AwQ=" }] }, { requestId: "multipart" });
            request({ postDataEntries: [{ bytes: "AID/" }] }, { requestId: "exact" });

            const bodies = await Promise.all(requests.map(req => req.body().catch(error => error.message)));

            assert.deepEqual(bodies, ["Body exceeds 3 bytes", "Body exceeds 3 bytes", Buffer.from([0, 128, 255])]);
        });

        it("should skip fetching a response when observed decoded bytes exceed the limit", async () => {
            request();
            response({ headers: { "Content-Length": "2", "Content-Encoding": "gzip" } });
            const body = responses[0].body();

            for (let i = 0; i < 2; i++) {
                cdp.network.emit(
                    "dataReceived",
                    { requestId: "request", dataLength: 2, encodedDataLength: 1 },
                    sessionId,
                );
            }
            finish();

            await assert.isRejected(body, /exceeds 3 bytes/);
            assert.notCalled(command.withArgs("Network.getResponseBody"));
        });

        it("should enforce the response limit when size events are missing", async () => {
            command.withArgs("Network.getResponseBody").resolves({ body: "Zm91cg==", base64Encoded: true });

            request();
            response();
            finish();

            await assert.isRejected(responses[0].body(), /exceeds 3 bytes/);
        });

        it("should allow a response exactly at the limit", async () => {
            command.withArgs("Network.getResponseBody").resolves({ body: "AID/", base64Encoded: true });

            request();
            response();
            cdp.network.emit("dataReceived", { requestId: "request", dataLength: 3, encodedDataLength: 3 }, sessionId);
            finish();

            assert.deepEqual(await responses[0].body(), Buffer.from([0, 128, 255]));
        });
    });
});
