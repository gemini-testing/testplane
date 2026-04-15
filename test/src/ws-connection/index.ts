import { WebSocket, WebSocketServer } from "ws";
import sinon, { SinonStub, SinonFakeTimers } from "sinon";
import proxyquire from "proxyquire";
import { WsConnection } from "src/ws-connection";
import {
    WsConnectionTerminatedError,
    WsError,
    WsConnectionEstablishmentError,
    WsConnectionBreakError,
    WsConnectionTimeoutError,
    WsRequestTimeoutError,
} from "src/ws-connection/error";
import { WS_MAX_REQUEST_ID } from "src/ws-connection/constants";

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

            const { id, method, params } = JSON.parse(data.toString("utf8"));

            switch (method) {
                case "Successful.Method":
                    ws.send(JSON.stringify({ id, result: { id, params } }));
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
                        }),
                    );
                    break;

                case "Flaky.Method": {
                    const respondAfter = params && "respondAfter" in params ? Number(params.respondAfter) : 3;
                    const message = params && "errorMessage" in params ? params.errorMessage : "error";
                    const code = params && "errorCode" in params ? Number(params.errorCode) : -32000;
                    const dontAnswer = params && "dontAnswer" in params;

                    if (flakyMethodCounter++ === respondAfter) {
                        ws.send(JSON.stringify({ id, result: { id, params } }));
                    } else if (!dontAnswer) {
                        ws.send(JSON.stringify({ id, error: { id, code, message } }));
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

class TestRequestError extends WsError {
    constructor(opts: { message: string; code?: number; requestId?: number }) {
        super(opts);
        this.name = "TestRequestError";
    }
    isRetryable(): boolean {
        return this.code !== -32000;
    }
}

class TestWsConnection extends WsConnection<Record<string, unknown>, string> {
    constructor(endpoint: string) {
        super(endpoint, {
            retries: { count: 3, baseDelay: 100 },
            timeouts: { request: 3000, createSession: 3000 },
            errors: {
                ConnectionEstablishment: WsConnectionEstablishmentError,
                ConnectionBreak: WsConnectionBreakError,
                ConnectionTerminated: WsConnectionTerminatedError,
                ConnectionTimeout: WsConnectionTimeoutError,
                RequestTimeout: WsRequestTimeoutError,
            },
            onMessage: data => {
                const message = data.toString("utf8");
                const jsonParsedMessage = JSON.parse(message);
                const requestId = jsonParsedMessage.id;

                if ("result" in jsonParsedMessage) {
                    this.provideResponseFor(requestId, jsonParsedMessage.result);
                } else if ("error" in jsonParsedMessage) {
                    this.provideResponseFor(
                        requestId,
                        new TestRequestError({
                            message: jsonParsedMessage.error.message,
                            code: jsonParsedMessage.error.code,
                            requestId,
                        }),
                    );
                }
            },
        });
    }

    async request<T = void>(method: string, params?: Record<string, unknown>): Promise<T> {
        let result!: T | WsError;

        for (let retriesLeft = 3; retriesLeft >= 0; retriesLeft--) {
            const id = this.getRequestId();
            const requestMessage = JSON.stringify({ id, method, params });

            result = (await this.makeRequest(id, requestMessage)) as T | WsError;

            if (!(result instanceof WsError) || !result.isRetryable() || retriesLeft <= 0) {
                break;
            }
        }

        if (result instanceof WsError) {
            throw result;
        }

        return result;
    }
}

describe('"WsConnection"', () => {
    const sandbox = sinon.createSandbox();
    let clock: SinonFakeTimers;
    let exponentiallyWaitStub: SinonStub;
    let WsConnectionProxied: typeof WsConnection;
    let TestWsConnectionProxied: typeof TestWsConnection;

    const mockEndpoint = `ws://localhost:${STUB_SERVER_PORT}`;

    beforeEach(() => {
        wsServer = createWsServer();
        clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
        exponentiallyWaitStub = sandbox.stub().resolves();

        WsConnectionProxied = proxyquire("src/ws-connection", {
            "./utils": {
                exponentiallyWait: exponentiallyWaitStub,
            },
        }).WsConnection;

        TestWsConnectionProxied = class extends WsConnectionProxied<Record<string, unknown>, string> {
            constructor(endpoint: string) {
                super(endpoint, {
                    retries: { count: 3, baseDelay: 100 },
                    timeouts: { request: 3000, createSession: 3000 },
                    errors: {
                        ConnectionEstablishment: WsConnectionEstablishmentError,
                        ConnectionBreak: WsConnectionBreakError,
                        ConnectionTerminated: WsConnectionTerminatedError,
                        ConnectionTimeout: WsConnectionTimeoutError,
                        RequestTimeout: WsRequestTimeoutError,
                    },
                    onMessage: data => {
                        const message = data.toString("utf8");
                        const jsonParsedMessage = JSON.parse(message);
                        const requestId = jsonParsedMessage.id;

                        if ("result" in jsonParsedMessage) {
                            this.provideResponseFor(requestId, jsonParsedMessage.result);
                        } else if ("error" in jsonParsedMessage) {
                            this.provideResponseFor(
                                requestId,
                                new TestRequestError({
                                    message: jsonParsedMessage.error.message,
                                    code: jsonParsedMessage.error.code,
                                    requestId,
                                }),
                            );
                        }
                    },
                });
            }

            async request<T = void>(method: string, params?: Record<string, unknown>): Promise<T> {
                let result!: T | WsError;

                for (let retriesLeft = 3; retriesLeft >= 0; retriesLeft--) {
                    const id = this.getRequestId();
                    const requestMessage = JSON.stringify({ id, method, params });

                    result = (await this.makeRequest(id, requestMessage)) as T | WsError;

                    if (!(result instanceof WsError) || !result.isRetryable() || retriesLeft <= 0) {
                        break;
                    }

                    if (!(result instanceof WsRequestTimeoutError)) {
                        await exponentiallyWaitStub();
                    }
                }

                if (result instanceof WsError) {
                    throw result;
                }

                return result;
            }
        } as unknown as typeof TestWsConnection;
    });

    afterEach(() => {
        clock.restore();
        sandbox.restore();
        wsServer?.closeConnections();
        wsServer?.close();
    });

    describe("request handling", () => {
        let connection: TestWsConnection;

        beforeEach(() => {
            connection = new TestWsConnectionProxied(mockEndpoint);
        });

        afterEach(() => {
            connection.close();
        });

        it("should generate unique request IDs", async () => {
            const promise1 = connection.request<unknown>("Successful.Method", { test: "1" });
            const promise2 = connection.request<unknown>("Successful.Method", { test: "2" });

            const [result1, result2] = await Promise.all([promise1, promise2]);

            assert.deepEqual(result1, { id: 1, params: { test: "1" } });
            assert.deepEqual(result2, { id: 2, params: { test: "2" } });
        });

        it("should wrap request ID at maximum value", async () => {
            Object.defineProperty(connection, "_requestId", { value: WS_MAX_REQUEST_ID - 1 });

            const promise1 = connection.request<unknown>("Successful.Method", { test: "1" });
            const promise2 = connection.request<unknown>("Successful.Method", { test: "2" });

            const [result1, result2] = await Promise.all([promise1, promise2]);

            assert.deepEqual(result1, { id: WS_MAX_REQUEST_ID, params: { test: "1" } });
            assert.deepEqual(result2, { id: 1, params: { test: "2" } });
        });
    });

    describe("connection establishment and retries", () => {
        let connection: TestWsConnection;

        beforeEach(() => {
            connection = new TestWsConnectionProxied(mockEndpoint);
        });

        afterEach(() => {
            connection.close();
        });

        it("should establish connection successfully", async () => {
            const result = await connection.request<unknown>("Successful.Method", { test: "value" });

            assert.deepEqual(result, { id: 1, params: { test: "value" } });
        });

        it("should fail after maximum connection retries", async () => {
            const badConnection = new TestWsConnectionProxied("ws://localhost:32105");
            const requestPromise = badConnection.request("Successful.Method");

            try {
                await assert.isRejected(
                    requestPromise,
                    WsConnectionEstablishmentError,
                    "Couldn't establish WS connection",
                );
            } finally {
                badConnection.close();
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

    describe("connection management and reconnection", () => {
        let connection: TestWsConnection;

        beforeEach(async () => {
            connection = new TestWsConnectionProxied(mockEndpoint);
            await connection.request("Successful.Method");
            Object.defineProperty(connection, "_requestId", { value: 0 });
        });

        afterEach(() => {
            connection.close();
        });

        it("should close connection and abort pending requests", async () => {
            await wsServer?.waitForConnection;

            const requestPromise = connection.request("Flaky.Method", { dontAnswer: true });

            connection.close();

            await assert.isRejected(requestPromise, WsConnectionTerminatedError);
        });

        it("should prevent new requests after close", async () => {
            connection.close();

            const requestPromise = connection.request("Successful.Method");

            await assert.isRejected(requestPromise, WsConnectionTerminatedError);
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

            getWsServerConnection().close();

            const result2 = await connection.request<unknown>("Successful.Method");
            assert.deepEqual(result2, { id: 3 });
        });

        it("should handle connection termination and reconnect", async () => {
            const result1 = await connection.request<unknown>("Successful.Method");
            assert.deepEqual(result1, { id: 1 });

            getWsServerConnection().terminate();

            const result2 = await connection.request<unknown>("Successful.Method");
            assert.deepEqual(result2, { id: 3 });
            assert.calledOnce(exponentiallyWaitStub);
        });
    });
});
