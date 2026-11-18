import sinon from "sinon";
import { CDP } from "src/browser/cdp";
import { CdpNetworkEventSource } from "src/browser/network-interception/cdp-network-event-source";
import type { NetworkRequest, NetworkResponse } from "src/browser/network-interception/types";
import type { CDPTargetInfo } from "src/browser/cdp/types";

const sessionId = "monitor-session";
const browserSessionId = "monitor-browser";

describe("CDP network event source", () => {
    const sandbox = sinon.createSandbox();
    let command: sinon.SinonStub;
    let cdp: CDP;
    let session: WebdriverIO.Browser;
    let monitor: CdpNetworkEventSource;
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
    const response = (overrides = {}, fromSession = sessionId, hasExtraInfo = true): void => {
        cdp.network.emit(
            "responseReceived",
            {
                requestId: "request",
                timestamp: 10.25,
                hasExtraInfo,
                response: { status: 200, statusText: "OK", headers: {}, ...overrides },
            },
            fromSession,
        );
    };
    const finish = (fromSession = sessionId): void => {
        cdp.network.emit("loadingFinished", { requestId: "request", timestamp: 10.5 }, fromSession);
    };

    const start = (): Promise<void> =>
        monitor.start({
            onRequest: value => requests.push(value),
            onResponse: value => responses.push(value),
            onFinished: finished,
            onFailed: failed,
        });

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
        monitor = new CdpNetworkEventSource(cdp, session, { maxBodySizeBytes: Infinity });
        requests = [];
        responses = [];
        finished = sandbox.spy();
        failed = sandbox.spy();
    });

    afterEach(async () => {
        await monitor[Symbol.asyncDispose]();
        sandbox.restore();
    });

    it("should expose request metadata and read the response only after completion", async () => {
        const bytes = Buffer.from([0, 255, 128]);
        command.withArgs("Network.getResponseBody").resolves({ body: bytes.toString("base64"), base64Encoded: true });
        await start();

        request({ hasPostData: true }, { type: "XHR" });
        response({ headers: { "Set-Cookie": "a=1\nb=2" } });
        const body = responses[0].consumeBody();
        await assert.isRejected(responses[0].consumeBody(), /already consumed/);
        finish();
        const [postData, responseData] = await Promise.all([requests[0].consumeBody(), body]);

        assert.include(requests[0], {
            url: "https://example.com/api",
            method: "POST",
            timestamp: 100000,
            resourceType: "xhr",
        });
        assert.include(responses[0], { request: requests[0], status: 200, timestamp: 100250 });
        assert.notProperty(responses[0], "timing");
        assert.deepEqual(responses[0].headers, [
            { name: "set-cookie", value: "a=1" },
            { name: "set-cookie", value: "b=2" },
        ]);
        assert.deepEqual([postData, responseData], [Buffer.from("post body"), bytes]);
        await assert.isRejected(requests[0].consumeBody(), /already consumed/);
        await assert.isRejected(responses[0].consumeBody(), /already consumed/);
        assert.calledOnce(command.withArgs("Network.getRequestPostData"));
        assert.calledOnce(command.withArgs("Network.getResponseBody"));
        assert.calledOnceWithExactly(finished, requests[0], 100500);
        assert.callOrder(finished, command.withArgs("Network.getResponseBody"));
    });

    it("should normalize response timing to an epoch baseline and millisecond offsets", async () => {
        await start();
        request();
        response({
            timing: {
                requestTime: 10.01,
                dnsStart: -1,
                dnsEnd: -1,
                connectStart: 2,
                connectEnd: 12,
                sslStart: 5,
                sslEnd: 12,
                sendStart: 12,
                sendEnd: 13,
                receiveHeadersStart: 40,
                receiveHeadersEnd: 41,
            },
        });

        assert.deepEqual(responses[0].timing, {
            startTime: 100010,
            dnsStart: undefined,
            dnsEnd: undefined,
            connectStart: 2,
            connectEnd: 12,
            tlsStart: 5,
            tlsEnd: 12,
            sendStart: 12,
            sendEnd: 13,
            responseHeadersStart: 40,
            responseHeadersEnd: 41,
        });
    });

    for (const requestFirst of [true, false]) {
        it(`should retain extra headers when request extra-info arrives ${requestFirst ? "after" : "before"} the request`, async () => {
            await start();
            const requestExtra = (): void => {
                cdp.network.emit(
                    "requestWillBeSentExtraInfo",
                    {
                        requestId: "request",
                        headers: { Cookie: "session=proof", Accept: "*/*" },
                    },
                    sessionId,
                );
            };
            const responseExtra = (): void => {
                cdp.network.emit(
                    "responseReceivedExtraInfo",
                    {
                        requestId: "request",
                        statusCode: 304,
                        headers: { "Set-Cookie": "first=1\nsecond=2" },
                    },
                    sessionId,
                );
            };
            if (requestFirst) {
                request();
                requestExtra();
            } else {
                requestExtra();
                request();
            }
            if (!requestFirst) {
                response();
                responseExtra();
            } else {
                responseExtra();
                response();
            }
            finish();
            await monitor[Symbol.asyncDispose]();

            assert.deepEqual(requests[0].headers, [
                { name: "cookie", value: "session=proof" },
                { name: "accept", value: "*/*" },
            ]);
            assert.equal(responses[0].status, 200);
            assert.equal(responses[0].networkStatus, 304);
            assert.deepEqual(responses[0].headers, [
                { name: "set-cookie", value: "first=1" },
                { name: "set-cookie", value: "second=2" },
            ]);
        });
    }

    it("should align late extra-info with redirect hops and skip hops without extra-info", async () => {
        await start();
        request();
        request(
            { url: "https://example.com/middle" },
            {
                redirectHasExtraInfo: true,
                redirectResponse: { status: 302, statusText: "Found", headers: { location: "/middle" } },
            },
        );
        request(
            { url: "https://example.com/final" },
            {
                redirectHasExtraInfo: false,
                redirectResponse: { status: 302, statusText: "Found", headers: { location: "/final" } },
            },
        );
        for (const hop of ["first", "final"]) {
            cdp.network.emit(
                "requestWillBeSentExtraInfo",
                { requestId: "request", headers: { Cookie: hop } },
                sessionId,
            );
            cdp.network.emit(
                "responseReceivedExtraInfo",
                {
                    requestId: "request",
                    statusCode: hop === "first" ? 302 : 200,
                    headers: { "Set-Cookie": hop },
                },
                sessionId,
            );
            monitor.reconcile();
        }
        assert.deepEqual(requests[2].headers, [{ name: "content-type", value: "text/plain" }]);
        assert.lengthOf(responses, 2);

        response();
        monitor.reconcile();
        monitor.reconcile();
        assert.lengthOf(responses, 3);

        assert.deepEqual(requests[0].headers, [{ name: "cookie", value: "first" }]);
        assert.deepEqual(requests[2].headers, [{ name: "cookie", value: "final" }]);
        assert.deepEqual(responses[0].headers, [{ name: "set-cookie", value: "first" }]);
        assert.deepEqual(responses[1].headers, [{ name: "location", value: "/final" }]);
        assert.deepEqual(responses[2].headers, [{ name: "set-cookie", value: "final" }]);
    });

    for (const extraFirst of [true, false]) {
        it(`should preserve CORS response metadata when extraFirst=${extraFirst}`, async () => {
            await start();
            request();
            const extra = (): void => {
                cdp.network.emit(
                    "responseReceivedExtraInfo",
                    {
                        requestId: "request",
                        statusCode: 418,
                        headers: { "X-Proof": "cors" },
                    },
                    sessionId,
                );
            };
            if (extraFirst) {
                extra();
                monitor.reconcile();
                assert.isEmpty(responses);
            }
            cdp.network.emit(
                "loadingFailed",
                {
                    requestId: "request",
                    timestamp: 10.5,
                    errorText: "net::ERR_FAILED",
                    corsErrorStatus: { corsError: "MissingAllowOriginHeader", failedParameter: "" },
                },
                sessionId,
            );
            if (!extraFirst) {
                extra();
            }
            monitor.reconcile();
            monitor.reconcile();
            assert.lengthOf(responses, 1);

            assert.equal(responses[0].networkStatus, 418);
            assert.deepEqual(responses[0].headers, [{ name: "x-proof", value: "cors" }]);
            assert.isUndefined(responses[0].timestamp);
            assert.deepEqual(requests[0].failureDetails, {
                corsError: "MissingAllowOriginHeader",
                failedParameter: "",
            });
            await assert.isRejected(responses[0].consumeBody(), /net::ERR_FAILED/);
        });
    }

    it("should keep redirect hops separate when CDP reuses the request id", async () => {
        await start();

        request({ hasPostData: true });
        // The recorder starts reading the body synchronously on the request event.
        const postData = requests[0].consumeBody();
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
        assert.deepEqual(await postData, Buffer.from("post body"));
        await assert.isRejected(responses[0].consumeBody(), /redirects/);
        assert.deepEqual(await responses[1].consumeBody(), Buffer.from("response body"));
        assert.calledTwice(finished);
    });

    it("should preserve raw request bytes and reject incomplete multipart bodies", async () => {
        await start();

        request({ postData: "lossy", postDataEntries: [{ bytes: "AID/" }, { bytes: "Kg==" }] });
        request({ postData: "partial", postDataEntries: [{ bytes: "aGk=" }, {}] }, { requestId: "multipart" });

        assert.deepEqual(await requests[0].consumeBody(), Buffer.from([0, 128, 255, 42]));
        await assert.isRejected(requests[1].consumeBody(), /unavailable data/);
    });

    it("should report a failed download and reject its pending body", async () => {
        await start();
        request();
        response();
        const body = responses[0].consumeBody();

        cdp.network.emit(
            "loadingFailed",
            { requestId: "request", timestamp: 10.3, errorText: "net::ERR_ABORTED", type: "Fetch" },
            sessionId,
        );

        assert.equal(requests[0].resourceType, "fetch");
        await assert.isRejected(body, /net::ERR_ABORTED/);
        assert.calledOnceWithExactly(failed, requests[0], 100300, "net::ERR_ABORTED");
        assert.notCalled(command.withArgs("Network.getResponseBody"));
    });

    it("should settle incomplete bodies and remove listeners when stopped", async () => {
        await start();
        request();
        response();
        const body = responses[0].consumeBody();

        await monitor[Symbol.asyncDispose]();
        await monitor[Symbol.asyncDispose]();

        await assert.isRejected(body, /stopped before/);
        assert.isEmpty(cdp.network.eventNames());
        assert.calledOnceWithExactly(command.withArgs("Target.detachFromTarget"), "Target.detachFromTarget", {
            sessionId: undefined,
            params: { sessionId: browserSessionId },
        });
    });

    it("should detach and remove listeners even if final reconciliation throws", async () => {
        const onResponse = sandbox.stub().throws(new Error("Could not record response"));
        await monitor.start({ onRequest: () => {}, onResponse, onFinished: finished, onFailed: failed });
        request();
        cdp.network.emit(
            "responseReceivedExtraInfo",
            { requestId: "request", statusCode: 418, headers: {} },
            sessionId,
        );

        await monitor.stop();

        assert.calledOnce(onResponse);
        assert.isEmpty(cdp.network.eventNames());
        assert.isEmpty(cdp.target.eventNames());
        assert.isEmpty(cdp.page.eventNames());
        assert.calledOnce(command.withArgs("Target.detachFromTarget"));
    });

    it("should wait for an ongoing body read before detaching", async () => {
        let complete!: sinon.SinonSpy;
        command.withArgs("Network.getResponseBody").returns(
            new Promise(resolve => {
                complete = sandbox.spy(resolve);
            }),
        );
        await start();
        request();
        response();
        const body = responses[0].consumeBody();
        finish();

        const stopped = monitor[Symbol.asyncDispose]();
        await flushAttachments();
        complete({ body: "done", base64Encoded: false });
        await stopped;

        assert.deepEqual(await body, Buffer.from("done"));
        assert.callOrder(complete, command.withArgs("Target.detachFromTarget"));
    });

    it("should clean up after Network.enable fails", async () => {
        command.withArgs("Network.enable").rejects(new Error("enable failed"));

        const started = start();

        await assert.isRejected(started, /enable failed/);
        assert.isEmpty(cdp.network.eventNames());
        assert.calledTwice(command.withArgs("Target.detachFromTarget"));
        assert.calledWithExactly(command, "Runtime.runIfWaitingForDebugger", { sessionId });
        assert.isEmpty(cdp.target.eventNames());
    });

    it("should refuse to record an arbitrary target if the current window is missing", async () => {
        command.withArgs("Target.getTargets").resolves({ targetInfos: [{ targetId: "unrelated-page", type: "page" }] });

        const started = start();

        await assert.isRejected(started, /Could not find/);
        assert.notCalled(command.withArgs("Target.attachToBrowserTarget"));
    });

    it("should capture a dedicated worker without using Page commands", async () => {
        await start();
        attach("worker-session", target("worker", "worker"), sessionId);
        await flushAttachments();
        request();
        request({ url: "https://example.com/worker" }, {}, "worker-session");
        response();
        response({}, "worker-session");
        finish();
        finish("worker-session");
        assert.lengthOf(requests, 2);
        assert.deepEqual(await responses[1].consumeBody(), Buffer.from("response body"));
        assert.notCalled(command.withArgs("Page.enable", { sessionId: "worker-session" }));
        assert.calledWithExactly(command, "Network.getResponseBody", {
            sessionId: "worker-session",
            params: { requestId: "request" },
        });
    });

    it("should include existing shared and service workers only from this browser context", async () => {
        targets.push(target("shared", "shared_worker"), target("service", "service_worker"));
        targets.push(target("unrelated", "service_worker", "other-context"));
        await start();

        request({}, {}, "session-shared");
        request({}, {}, "session-service");
        request({}, {}, "session-unrelated");

        assert.lengthOf(requests, 2);
        assert.calledWithExactly(command, "Target.setAutoAttach", {
            sessionId: browserSessionId,
            params: {
                autoAttach: true,
                waitForDebuggerOnStart: true,
                flatten: true,
                filter: [{ type: "page" }, { type: "shared_worker" }, { type: "service_worker" }, { exclude: true }],
            },
        });
        assert.calledWithExactly(command, "Target.detachFromTarget", {
            sessionId: browserSessionId,
            params: { sessionId: "session-unrelated" },
        });
        assert.calledWithExactly(command, "Target.setAutoAttach", {
            sessionId,
            params: {
                autoAttach: true,
                waitForDebuggerOnStart: true,
                flatten: true,
                filter: [{ type: "iframe" }, { type: "worker" }, { exclude: true }],
            },
        });
    });

    it("should attach nested workers and settle their pending bodies when their parent closes", async () => {
        command.withArgs("Network.getResponseBody").returns(new Promise(() => {}));
        await start();
        attach("worker-session", target("worker", "worker"), sessionId);
        await flushAttachments();
        attach("nested-worker-session", target("nested", "worker"), "worker-session");
        await flushAttachments();
        request({}, {}, "nested-worker-session");
        response({}, "nested-worker-session");
        finish("nested-worker-session");
        const body = responses[0].consumeBody();
        await Promise.resolve();

        detached("worker-session");

        await assert.isRejected(body, /no longer available/);
        assert.calledOnce(command.withArgs("Page.enable"));
    });

    it("should isolate tabs with reused request ids and exclude unrelated browser contexts", async () => {
        targets.push(target("second"), target("unrelated", "page", "other-context"));
        (session.getWindowHandles as sinon.SinonStub).resolves(["CDwindow-page", "second"]);
        await start();

        for (const fromSession of [sessionId, "session-second"]) {
            cdp.network.emit(
                "requestWillBeSentExtraInfo",
                { requestId: "request", headers: { Cookie: fromSession } },
                fromSession,
            );
        }
        request();
        request({ url: "https://example.com/second" }, {}, "session-second");
        request({}, {}, "session-unrelated");
        response();
        response({}, "session-second");
        finish();
        finish("session-second");
        await Promise.all(responses.map(res => res.consumeBody()));

        assert.deepEqual(
            responses.map(res => res.request),
            requests,
        );
        monitor.reconcile();
        assert.deepEqual(
            requests.map(req => req.headers),
            [[{ name: "cookie", value: sessionId }], [{ name: "cookie", value: "session-second" }]],
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
        await start();
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
        assert.deepEqual(await responses[0].consumeBody(), Buffer.from("response body"));
        assert.callOrder(
            command.withArgs("Network.enable", { sessionId: "popup-session", params: undefined }),
            command.withArgs("Runtime.runIfWaitingForDebugger", { sessionId: "popup-session" }),
        );
    });

    it("should observe same-process frames and recursively attach to out-of-process frames", async () => {
        await start();
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
        assert.deepEqual(await responses[0].consumeBody(), Buffer.from("response body"));
        assert.calledWithExactly(command, "Network.getResponseBody", {
            sessionId: "nested-session",
            params: { requestId: "request" },
        });
    });

    it("should correlate iframe navigation across sessions and fetch its body from the finishing session", async () => {
        await start();
        request({}, { loaderId: "request", frameId: "frame" });
        response();
        const body = responses[0].consumeBody();
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
        await start();
        attach("frame-session", target("frame", "iframe"), sessionId);
        await flushAttachments();
        request({}, { loaderId: "request", frameId: "frame" }, "frame-session");
        response({}, "frame-session");
        const body = responses[0].consumeBody();
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
        await start();
        attach("frame-session", target("frame", "iframe"), sessionId);
        await flushAttachments();
        request({}, {}, "frame-session");
        response({}, "frame-session");
        finish("frame-session");
        const body = responses[0].consumeBody();
        await Promise.resolve();

        detached(sessionId);
        await monitor[Symbol.asyncDispose]();

        await assert.isRejected(body, /no longer available/);
        assert.isEmpty(cdp.network.eventNames());
    });

    describe("body size limit", () => {
        beforeEach(async () => {
            monitor = new CdpNetworkEventSource(cdp, session, { maxBodySizeBytes: 3 });
            await start();
        });

        it("should limit decoded bytes, including UTF-8 and multipart request data", async () => {
            request({ postData: "éé" });
            request({ postDataEntries: [{ bytes: "AQI=" }, { bytes: "AwQ=" }] }, { requestId: "multipart" });
            request({ postDataEntries: [{ bytes: "AID/" }] }, { requestId: "exact" });

            const bodies = await Promise.all(requests.map(req => req.consumeBody().catch(error => error.message)));

            assert.deepEqual(bodies, ["Body exceeds 3 bytes", "Body exceeds 3 bytes", Buffer.from([0, 128, 255])]);
        });

        it("should apply the fallback request body limit to decoded bytes", async () => {
            command.withArgs("Network.getRequestPostData").resolves({ postData: "AID/", base64Encoded: true });
            request({ hasPostData: true });
            assert.deepEqual(await requests[0].consumeBody(), Buffer.from([0, 128, 255]));

            command.withArgs("Network.getRequestPostData").resolves({ postData: "Zm91cg==", base64Encoded: true });
            request({ hasPostData: true }, { requestId: "large" });
            await assert.isRejected(requests[1].consumeBody(), /exceeds 3 bytes/);
        });

        it("should skip fetching a response when observed decoded bytes exceed the limit", async () => {
            request();
            response({ headers: { "Content-Length": "2", "Content-Encoding": "gzip" } });
            const body = responses[0].consumeBody();

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

            await assert.isRejected(responses[0].consumeBody(), /exceeds 3 bytes/);
        });

        it("should allow a response exactly at the limit", async () => {
            command.withArgs("Network.getResponseBody").resolves({ body: "AID/", base64Encoded: true });

            request();
            response();
            cdp.network.emit("dataReceived", { requestId: "request", dataLength: 3, encodedDataLength: 3 }, sessionId);
            finish();

            assert.deepEqual(await responses[0].consumeBody(), Buffer.from([0, 128, 255]));
        });
    });
});
