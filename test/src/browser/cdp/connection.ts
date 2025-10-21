import { WebSocket, WebSocketServer } from "ws";
import sinon, { SinonStub, SinonFakeTimers } from "sinon";
import proxyquire from "proxyquire";
import { CDPConnection } from "src/browser/cdp/connection";
import { CDPError, CDPConnectionTerminatedError } from "src/browser/cdp/error";
import { CDP_MAX_REQUEST_ID } from "src/browser/cdp/constants";
import type { CDPEvent, CDPErrorResponse, CDPRequest, CDPResponse } from "src/browser/cdp/types";
import type { Browser } from "src/browser/types";

const STUB_SERVER_PORT = 50123;

type StubWebSocketServer = WebSocketServer & {
    waitForConnection: Promise<WebSocket>;
    connectionsCounter: number;
    requestsCounter: number;
    closeConnections: () => void;
};

let wsServerConnection: WebSocket | null = null;
let wsServer: StubWebSocketServer | null = null;

const createWsServer = (): StubWebSocketServer => {
    const wss = new WebSocketServer({ port: STUB_SERVER_PORT }) as StubWebSocketServer;

    let resolveHangingPromise: ((ws: WebSocket) => void) | null = null;
    let connectionsCounter = 0;
    let requestsCounter = 0;

    const hangingPromise = new Promise<WebSocket>(resolve => {
        resolveHangingPromise = resolve;
    });

    Object.defineProperty(wss, "waitForConnection", { value: hangingPromise });
    Object.defineProperty(wss, "connectionsCounter", { get: () => connectionsCounter });
    Object.defineProperty(wss, "requestsCounter", { get: () => requestsCounter });
    Object.defineProperty(wss, "closeConnections", { value: () => wss.clients.forEach(ws => ws.close()) });

    wss.on("connection", ws => {
        connectionsCounter++;
        wsServerConnection = ws;
        resolveHangingPromise?.(ws);

        let flakyMethodCounter = 0;

        ws.on("ping", () => ws.pong());
        ws.on("message", data => {
            requestsCounter++;

            const { id, method, params, sessionId } = JSON.parse(data.toString("utf8")) as CDPRequest;

            switch (method) {
                case "Successful.Method":
                    ws.send(JSON.stringify({ id, result: { id, params, sessionId } } as CDPResponse));
                    break;

                case "Unsuccessful.Method":
                    ws.send(
                        JSON.stringify({
                            id,
                            error: {
                                id,
                                code: params && "code" in params ? params.code : 0,
                                message: params && "message" in params ? params.message : "",
                            },
                        } as CDPErrorResponse),
                    );
                    break;

                case "Flaky.Method": {
                    const respondAfter = params && "respondAfter" in params ? Number(params.respondAfter) : 3;
                    const message = params && "errorMessage" in params ? params.errorMessage : "error";
                    const code = params && "errorCode" in params ? Number(params.errorCode) : -32000;
                    const dontAnswer = params && "dontAnswer" in params;

                    if (flakyMethodCounter++ === respondAfter) {
                        ws.send(JSON.stringify({ id, result: { id, params, sessionId } } as CDPResponse));
                    } else if (!dontAnswer) {
                        ws.send(JSON.stringify({ id, error: { id, code, message } } as CDPErrorResponse));
                    }

                    break;
                }
            }
        });
    });

    return wss;
};

const getWsServerConnection = (): WebSocket => {
    if (!wsServerConnection) {
        throw Error("Connection is not established");
    }

    return wsServerConnection;
};

describe('"CDPConnection"', () => {
    const sandbox = sinon.createSandbox();
    let clock: SinonFakeTimers;
    let getWsEndpointStub: SinonStub;
    let exponentiallyWaitStub: SinonStub;
    let extractRequestIdFromBrokenResponseStub: SinonStub;
    let debugCdpStub: SinonStub;
    let CDPConnectionProxied: typeof CDPConnection;

    const mockBrowser = {
        publicAPI: {
            sessionId: "test-session-id",
        },
    } as Browser;

    const mockEndpoint = `ws://localhost:${STUB_SERVER_PORT}`;

    beforeEach(() => {
        wsServer = createWsServer();
        clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
        getWsEndpointStub = sandbox.stub().resolves(mockEndpoint);
        exponentiallyWaitStub = sandbox.stub().resolves();
        extractRequestIdFromBrokenResponseStub = sandbox.stub().returns(null);
        debugCdpStub = sandbox.stub();

        CDPConnectionProxied = proxyquire("src/browser/cdp/connection", {
            "./ws-endpoint": { getWsEndpoint: getWsEndpointStub },
            "./utils": {
                exponentiallyWait: exponentiallyWaitStub,
                extractRequestIdFromBrokenResponse: extractRequestIdFromBrokenResponseStub,
            },
            "./debug": { debugCdp: debugCdpStub },
        }).CDPConnection;
    });

    afterEach(() => {
        clock.restore();
        sandbox.restore();
        wsServer?.closeConnections();
        wsServer?.close();
    });

    describe("create", () => {
        it("should create CDPConnection instance", async () => {
            const connection = await CDPConnectionProxied.create(mockBrowser);

            assert.instanceOf(connection, CDPConnectionProxied);
            assert.calledOnce(getWsEndpointStub);
            assert.calledWith(getWsEndpointStub, mockBrowser);
        });

        it("should throw error if CDP endpoint cannot be determined", async () => {
            getWsEndpointStub.resolves(null);

            await assert.isRejected(
                CDPConnectionProxied.create(mockBrowser),
                CDPError,
                "Couldn't determine CDP endpoint for session test-session-id",
            );
        });
    });

    describe("request handling", () => {
        let connection: CDPConnection;

        beforeEach(async () => {
            connection = await CDPConnectionProxied.create(mockBrowser);
        });

        afterEach(() => {
            connection.close();
        });

        it("should send request and receive successful response", async () => {
            const response = await connection.request<unknown>("Successful.Method", { params: { test: "value" } });

            assert.deepEqual(response, { id: 1, params: { test: "value" } });
        });

        it("should handle CDP error response", async () => {
            const requestPromise = connection.request("Unsuccessful.Method", {
                params: { message: "serverErrorMessage" },
            });

            await assert.isRejected(requestPromise, CDPError, "serverErrorMessage");
        });

        it("should generate unique request IDs", async () => {
            const promise1 = connection.request<unknown>("Successful.Method", { params: { test: "1" } });
            const promise2 = connection.request<unknown>("Successful.Method", { params: { test: "2" } });

            const [result1, result2] = await Promise.all([promise1, promise2]);

            // Verify both requests completed successfully
            assert.deepEqual(result1, { id: 1, params: { test: "1" } });
            assert.deepEqual(result2, { id: 2, params: { test: "2" } });
        });

        it("should wrap request ID at maximum value", async () => {
            // Set the connection's request ID to near maximum
            Object.defineProperty(connection, "_requestId", { value: CDP_MAX_REQUEST_ID - 1 });

            const promise1 = connection.request<unknown>("Successful.Method", { params: { test: "1" } });
            const promise2 = connection.request<unknown>("Successful.Method", { params: { test: "2" } });

            const [result1, result2] = await Promise.all([promise1, promise2]);

            // Verify both requests completed successfully
            assert.deepEqual(result1, { id: CDP_MAX_REQUEST_ID, params: { test: "1" } });
            assert.deepEqual(result2, { id: 1, params: { test: "2" } });
        });

        it("should handle request with sessionId", async () => {
            const result = await connection.request<unknown>("Successful.Method", {
                sessionId: "custom-session-id",
                params: { test: "value" },
            });

            // Verify the request completed successfully and sessionId was passed
            assert.deepEqual(result, {
                id: 1,
                params: { test: "value" },
                sessionId: "custom-session-id",
            });
        });
    });

    // Error codes outside the range -32700 to -32600 and not -32000 are retryable
    describe("request retries", () => {
        let connection: CDPConnection;

        beforeEach(async () => {
            connection = await CDPConnectionProxied.create(mockBrowser);
        });

        afterEach(async () => {
            connection.close();
        });

        it("should retry requests on retryable errors", async () => {
            const response = await connection.request<unknown>("Flaky.Method", {
                params: { respondAfter: 3, errorCode: -1000 },
            });

            // Verify that exponentiallyWait was called for retries
            assert.callCount(exponentiallyWaitStub, 3);
            assert.equal(wsServer?.requestsCounter, 4);
            assert.deepEqual(response, { id: 4, params: { respondAfter: 3, errorCode: -1000 } });
        });

        it("should stop retrying after maximum attempts", async () => {
            // All attempts will fail with retryable error
            const requestPromise = connection.request("Unsuccessful.Method", {
                params: { message: "Persistent error", code: -30000 },
            });

            await assert.isRejected(requestPromise, CDPError, "Persistent error");
            assert.equal(wsServer?.requestsCounter, 4);
        });

        it("should not retry non-retryable errors", async () => {
            const requestPromise = connection.request("Unsuccessful.Method", {
                params: { message: "Persistent error", code: -32000 },
            });

            await assert.isRejected(requestPromise, CDPError, "Persistent error");
            assert.equal(wsServer?.requestsCounter, 1);
        });
    });

    describe("connection establishment and retries", () => {
        let connection: CDPConnection;

        beforeEach(async () => {
            connection = await CDPConnectionProxied.create(mockBrowser);
        });

        afterEach(() => {
            connection.close();
        });

        it("should establish connection successfully", async () => {
            // Make a request to verify connection is established
            const result = await connection.request<unknown>("Successful.Method", { params: { test: "value" } });

            assert.deepEqual(result, { id: 1, params: { test: "value" } });
            assert.calledWith(getWsEndpointStub, mockBrowser);
        });

        it("should fail after maximum connection retries", async () => {
            // Always return non-existent port
            getWsEndpointStub.resolves("ws://localhost:32105");

            const connection = await CDPConnectionProxied.create(mockBrowser);
            const requestPromise = connection.request("Runtime.enable");

            try {
                await assert.isRejected(requestPromise, CDPError, "Couldn't establish CDP connection");
            } finally {
                connection.close();
            }
        });

        it("should connect once on multiple requests", async () => {
            const [r1, r2, r3] = await Promise.all([
                connection.request<unknown>("Successful.Method"),
                connection.request<unknown>("Successful.Method"),
                connection.request<unknown>("Successful.Method"),
            ]);

            assert.deepEqual(r1, { id: 1 });
            assert.deepEqual(r2, { id: 2 });
            assert.deepEqual(r3, { id: 3 });
            assert.equal(wsServer?.connectionsCounter, 1);
        });
    });

    describe("event handling", () => {
        let connection: CDPConnection;

        beforeEach(async () => {
            connection = await CDPConnectionProxied.create(mockBrowser);

            await connection.request("Successful.Method"); // Establishes connection

            Object.defineProperty(connection, "_requestId", { value: 0 });
        });

        afterEach(async () => {
            connection.close();
        });

        it("should forward CDP events to event handler", async () => {
            // Send CDP event (message without id)
            const eventHandler = (connection.onEventMessage = sinon.stub());
            const event: CDPEvent = {
                method: "Runtime.consoleAPICalled",
                params: { type: "log", args: [{ value: "test" }] },
            };

            getWsServerConnection().send(JSON.stringify(event));

            // Await for event to settle
            await connection.request("Successful.Method");

            assert.calledOnceWith(eventHandler, event);
        });

        it("should not forward events if no handler is set", async () => {
            // Send CDP event (message without id)
            const event: CDPEvent = {
                method: "Runtime.consoleAPICalled",
                params: { type: "log", args: [{ value: "test" }] },
            };

            getWsServerConnection().send(JSON.stringify(event));

            // Await for event to settle
            // Should not throw any errors
            await connection.request("Successful.Method");
        });

        it("should handle malformed JSON messages", async () => {
            // Send malformed JSON
            getWsServerConnection().send("invalid json");

            // Make a request to ensure connection is still working
            const result = await connection.request<unknown>("Successful.Method", { params: {} });

            // Should handle malformed JSON gracefully and still process valid requests
            assert.deepEqual(result, { id: 1, params: {} });
        });

        it("should retry + handle malformed response with extractable request ID", async () => {
            let brokenRequestIdCounter = 1;

            extractRequestIdFromBrokenResponseStub.callsFake(() => brokenRequestIdCounter++);

            const serverWs = getWsServerConnection();

            let requestsCount = 0;
            // Override server's message handler to send malformed response
            serverWs.removeAllListeners("message");
            serverWs.on("message", () => {
                requestsCount++;
                // Send malformed JSON with extractable request ID
                serverWs.send('{"id":1,"invalid"}');
            });

            const requestPromise = connection.request("Successful.Method");
            await assert.isRejected(requestPromise, CDPError, "Received malformed response: response is invalid JSON");
            assert.equal(requestsCount, 4);
        });

        it("should ignore responses for unknown request IDs", async () => {
            await wsServer?.waitForConnection;
            const serverWs = getWsServerConnection();

            // Send response with unknown request ID first
            serverWs.send(JSON.stringify({ id: 999, result: {} }));

            // Make a normal request - should work despite the unknown response
            const result = await connection.request<unknown>("Successful.Method", { params: { test: "value" } });
            assert.deepEqual(result, { id: 1, params: { test: "value" } });
        });
    });

    describe("connection management and reconnection", () => {
        let connection: CDPConnection;

        beforeEach(async () => {
            connection = await CDPConnectionProxied.create(mockBrowser);

            await connection.request("Successful.Method"); // Establishes connection

            Object.defineProperty(connection, "_requestId", { value: 0 });
        });

        afterEach(async () => {
            connection.close();
        });

        it("should close connection and abort pending requests", async () => {
            await wsServer?.waitForConnection;

            const requestPromise = connection.request("Timeout.Method", { params: {} });

            // Close connection manually before timeout
            connection.close();

            await assert.isRejected(requestPromise, CDPConnectionTerminatedError);
        });

        it("should prevent new requests after close", async () => {
            connection.close();

            const requestPromise = connection.request("Runtime.enable");

            await assert.isRejected(requestPromise, CDPConnectionTerminatedError);
        });

        it("should reuse existing connection for multiple requests", async () => {
            const promise1 = connection.request<unknown>("Successful.Method");
            const promise2 = connection.request<unknown>("Successful.Method");

            const [result1, result2] = await Promise.all([promise1, promise2]);

            assert.deepEqual(result1, { id: 1 });
            assert.deepEqual(result2, { id: 2 });
        });

        it("should handle connection drop and reconnect", async () => {
            const result1 = await connection.request<unknown>("Successful.Method");
            assert.deepEqual(result1, { id: 1 });

            // Simulate connection drop
            getWsServerConnection().close();

            // Make second request (should trigger reconnection)
            const result2 = await connection.request<unknown>("Successful.Method");
            assert.deepEqual(result2, { id: 3 });
        });

        it("should handle connection termination and reconnect", async () => {
            const result1 = await connection.request<unknown>("Successful.Method");
            assert.deepEqual(result1, { id: 1 });

            // Simulate connection error
            getWsServerConnection().terminate();

            // Make request (should trigger reconnection)
            // Request is retried because of termination
            const result2 = await connection.request<unknown>("Successful.Method");
            assert.deepEqual(result2, { id: 3 });
            assert.calledOnce(exponentiallyWaitStub);
        });
    });
});
