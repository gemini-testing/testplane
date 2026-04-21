import { WebSocket, WebSocketServer } from "ws";
import sinon, { SinonStub, SinonFakeTimers } from "sinon";
import proxyquire from "proxyquire";
import { CDPConnection } from "src/browser/cdp/connection";
import { CDPError, CDPRequestError } from "src/browser/cdp/error";
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
            "../../ws-connection/utils": {
                exponentiallyWait: exponentiallyWaitStub,
            },
            "./utils": {
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

            await assert.isRejected(requestPromise, CDPRequestError, "serverErrorMessage");
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

    describe("event handling", () => {
        let connection: CDPConnection;

        beforeEach(async () => {
            connection = await CDPConnectionProxied.create(mockBrowser);

            await connection.request("Successful.Method"); // Establishes connection
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
            assert.deepEqual(result, { id: 2, params: {} });
        });

        it("should ignore responses for unknown request IDs", async () => {
            await wsServer?.waitForConnection;
            const serverWs = getWsServerConnection();

            // Send response with unknown request ID first
            serverWs.send(JSON.stringify({ id: 999, result: {} }));

            // Make a normal request - should work despite the unknown response
            const result = await connection.request<unknown>("Successful.Method", { params: { test: "value" } });
            assert.deepEqual(result, { id: 2, params: { test: "value" } });
        });
    });
});
