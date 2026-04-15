/* eslint-disable no-bitwise */
import { WebSocket, WebSocketServer } from "ws";
import sinon, { SinonStub, SinonFakeTimers } from "sinon";
import proxyquire from "proxyquire";
import { WSDriverRequestAgent } from "src/browser/wsdriver";
import { WSDriverError } from "src/browser/wsdriver/error";
import { WsDriverMessage, WsDriverCompression } from "src/browser/wsdriver/types";
import { BrowserConfig } from "src/config/browser-config";

const STUB_SERVER_PORT = 50124;

type StubWebSocketServer = WebSocketServer & {
    waitForConnection: Promise<WebSocket>;
    connectionsCounter: number;
    requestsCounter: number;
    closeConnections: () => void;
};

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
        resolveHangingPromise?.(ws);

        ws.on("ping", () => ws.pong());
        ws.on("message", data => {
            requestsCounter++;

            const buffer = data as Buffer;
            const requestId = buffer.readUInt32BE(2);
            const commandEnd = buffer.indexOf(0, 8);
            const command = buffer.toString("utf8", 8, commandEnd);

            if (command === "success") {
                const body = Buffer.from(JSON.stringify({ value: "ok" }));
                const response = Buffer.alloc(8 + command.length + 1 + body.length);
                response.writeUInt8(1, 0);
                response.writeUInt8((WsDriverMessage.Response << 4) | (WsDriverCompression.None << 2) | 2, 1);
                response.writeUInt32BE(requestId, 2);
                response.writeUInt16BE(200, 6);
                Buffer.from(command).copy(response, 8);
                response.writeUInt8(0, 8 + command.length);
                body.copy(response, 8 + command.length + 1);
                ws.send(response);
            } else if (command === "protocol-error") {
                const body = Buffer.from("error");
                const response = Buffer.alloc(8 + command.length + 1 + body.length);
                response.writeUInt8(1, 0);
                response.writeUInt8((WsDriverMessage.Response << 4) | (WsDriverCompression.None << 2) | 1, 1); // isProtocolError = 1
                response.writeUInt32BE(requestId, 2);
                response.writeUInt16BE(500, 6);
                Buffer.from(command).copy(response, 8);
                response.writeUInt8(0, 8 + command.length);
                body.copy(response, 8 + command.length + 1);
                ws.send(response);
            }
        });
    });

    return wss;
};

describe('"WSDriverRequestAgent"', () => {
    const sandbox = sinon.createSandbox();
    let clock: SinonFakeTimers;
    let exponentiallyWaitStub: SinonStub;
    let WSDriverRequestAgentProxied: typeof WSDriverRequestAgent;

    const mockBrowserConfig = {
        httpTimeout: 3000,
    } as BrowserConfig;

    beforeEach(() => {
        wsServer = createWsServer();
        clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
        exponentiallyWaitStub = sandbox.stub().resolves();

        WSDriverRequestAgentProxied = proxyquire("src/browser/wsdriver", {
            "../../ws-connection/utils": {
                exponentiallyWait: exponentiallyWaitStub,
            },
            "../../utils/logger": {
                error: sandbox.stub(),
                warn: sandbox.stub(),
                info: sandbox.stub(),
            },
        }).WSDriverRequestAgent;
    });

    afterEach(() => {
        clock.restore();
        sandbox.restore();
        wsServer?.closeConnections();
        wsServer?.close();
    });

    describe("create", () => {
        it("should create WSDriverRequestAgent instance", () => {
            const connection = WSDriverRequestAgentProxied.create({
                sessionId: "123",
                sessionCaps: { "se:wsdriver": `ws://localhost:${STUB_SERVER_PORT}`, "se:wsdriverVersion": "1" },
                headers: {},
                browserConfig: mockBrowserConfig,
            });

            assert.instanceOf(connection, WSDriverRequestAgentProxied);
        });

        it("should throw error if wsdriver endpoint is missing", () => {
            assert.throws(
                () =>
                    WSDriverRequestAgentProxied.create({
                        sessionId: "123",
                        sessionCaps: { "se:wsdriverVersion": "1" },
                        headers: {},
                        browserConfig: mockBrowserConfig,
                    }),
                WSDriverError,
                "Couldn't determine wsdriver endpoint",
            );
        });

        it("should throw error if wsdriver version is missing", () => {
            assert.throws(
                () =>
                    WSDriverRequestAgentProxied.create({
                        sessionId: "123",
                        sessionCaps: { "se:wsdriver": `ws://localhost:${STUB_SERVER_PORT}` },
                        headers: {},
                        browserConfig: mockBrowserConfig,
                    }),
                WSDriverError,
                "Couldn't determine wsdriver supported versions",
            );
        });
    });

    describe("request handling", () => {
        let connection: WSDriverRequestAgent;

        beforeEach(async () => {
            connection = WSDriverRequestAgentProxied.create({
                sessionId: "123",
                sessionCaps: { "se:wsdriver": `ws://localhost:${STUB_SERVER_PORT}`, "se:wsdriverVersion": "1" },
                headers: {},
                browserConfig: mockBrowserConfig,
            });
        });

        afterEach(() => {
            connection.close();
        });

        it("should send request and receive successful response", async () => {
            const url = new URL(`http://localhost/session/123/success`);
            const response = await connection.request(url, { method: "GET" });

            assert.equal(response.statusCode, 200);
            assert.deepEqual(response.body, { value: "ok" });
        });

        it("should handle protocol error", async () => {
            const url = new URL(`http://localhost/session/123/protocol-error`);
            const requestPromise = connection.request(url, { method: "GET" });

            await assert.isRejected(requestPromise, /Protocol error/);
        });
    });
});
