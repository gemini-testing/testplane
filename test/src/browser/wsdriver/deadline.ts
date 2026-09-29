import { URL } from "node:url";
import { createServer, Server } from "node:http";
import { AddressInfo, Socket } from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocketServer, WebSocket } from "ws";
import sinon from "sinon";
import { WSDriverRequestAgent } from "src/browser/wsdriver";
import { WSDriverRequestDeadlineError } from "src/browser/wsdriver/error";
import { BrowserConfig } from "src/config/browser-config";

const flag = "TESTPLANE_WSDRIVER_DEADLINE_ENABLED";

describe("WSDriver command deadline", () => {
    let oldFlag: string | undefined;
    let server: Server;
    let wsServer: WebSocketServer;
    let agent: WSDriverRequestAgent;
    let requests: number;
    let connections: number;
    let sockets: Set<Socket>;
    let onDeadline: sinon.SinonSpy;

    beforeEach(() => {
        oldFlag = process.env[flag];
        process.env[flag] = "true";
        requests = 0;
        connections = 0;
        sockets = new Set();
        onDeadline = sinon.spy();
    });

    afterEach(async () => {
        agent?.close();
        for (const socket of sockets) socket.destroy();
        if (wsServer) await new Promise<void>(resolve => wsServer.close(() => resolve()));
        if (server) await new Promise<void>(resolve => server.close(() => resolve()));
        if (oldFlag === undefined) delete process.env[flag];
        else process.env[flag] = oldFlag;
    });

    async function start(
        handle?: (ws: WebSocket, request: Buffer) => void,
        { handshake = true, httpTimeout = 100 }: { handshake?: boolean; httpTimeout?: number } = {},
    ): Promise<void> {
        server = createServer();
        server.on("connection", socket => {
            sockets.add(socket);
            socket.on("close", () => sockets.delete(socket));
            socket.on("end", () => socket.destroy());
        });
        wsServer = new WebSocketServer({ noServer: true });
        server.on("upgrade", (request, socket, head) => {
            connections++;
            socket.resume();
            if (handshake) {
                wsServer.handleUpgrade(request, socket, head, ws => {
                    wsServer.emit("connection", ws);
                });
            }
        });
        wsServer.on("connection", ws => {
            ws.on("message", message => {
                requests++;
                handle?.(ws, message as Buffer);
            });
        });
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const port = (server.address() as AddressInfo).port;
        agent = WSDriverRequestAgent.create({
            sessionId: "session",
            sessionCaps: { "se:wsdriver": `ws://127.0.0.1:${port}`, "se:wsdriverVersion": "1" },
            headers: {},
            browserConfig: { httpTimeout } as BrowserConfig,
            onRequestDeadline: onDeadline,
        });
    }

    function request(responseTimeout?: number): ReturnType<WSDriverRequestAgent["request"]> {
        return agent.request(new URL("http://localhost/session/session/title"), {
            method: "GET",
            ...(responseTimeout === undefined ? {} : { timeout: { response: responseTimeout } }),
        });
    }

    function respond(ws: WebSocket, request: Buffer): void {
        const response = Buffer.concat([request.subarray(0, 8), Buffer.from('title\0{"value":"ok"}')]);
        response.writeUInt8(18, 1);
        response.writeUInt16BE(200, 6);
        ws.send(response);
    }

    it("reuses a healthy connection and does not mark the session broken", async () => {
        await start(respond);
        assert.equal((await request()).statusCode, 200);
        assert.equal((await request()).statusCode, 200);
        assert.equal(connections, 1);
        assert.equal(requests, 2);
        assert.equal(onDeadline.callCount, 0);
    });

    it("aborts a pending handshake without sending commands or reconnecting", async () => {
        await start(undefined, { handshake: false });
        await assert.isRejected(request(), WSDriverRequestDeadlineError);
        await delay(50);
        assert.equal(sockets.size, 0);
        assert.equal(connections, 1);
        assert.equal(requests, 0);
        assert.equal(onDeadline.callCount, 1);
    });

    it("terminates a hung request and rejects subsequent commands on that session", async () => {
        await start();
        const error = await request().catch(error => error);
        assert.instanceOf(error, WSDriverRequestDeadlineError);
        assert.equal(error.code, "WSDRIVER_REQUEST_DEADLINE");
        await assert.isRejected(request(), WSDriverRequestDeadlineError);
        await delay(50);
        assert.equal(sockets.size, 0);
        assert.equal(requests, 1);
        assert.equal(onDeadline.callCount, 1);
    });

    it("includes reconnect and request retry backoff in the same deadline", async () => {
        await start(ws => ws.terminate());
        const started = performance.now();
        await assert.isRejected(request(), WSDriverRequestDeadlineError);
        assert.isBelow(performance.now() - started, 1000);
        const sentBeforeDeadline = requests;
        await delay(150);
        assert.equal(requests, sentBeforeDeadline);
        assert.equal(sockets.size, 0);
        assert.equal(onDeadline.callCount, 1);
    });

    it("uses the per-command response timeout", async () => {
        await start(undefined, { httpTimeout: 5000 });
        await assert.isRejected(request(100), "timed out after 100ms");
        assert.equal(onDeadline.callCount, 1);
    });

    for (const value of [undefined, "false"]) {
        it(`preserves the legacy timeout with flag=${value}`, async () => {
            if (value === undefined) delete process.env[flag];
            else process.env[flag] = value;
            await start();
            const error = await request().catch(error => error);
            assert.equal(error.code, "ETIMEDOUT");
            assert.equal(onDeadline.callCount, 0);
        });

        it(`closes an unfinished handshake with flag=${value}`, async () => {
            if (value === undefined) delete process.env[flag];
            else process.env[flag] = value;
            await start(undefined, { handshake: false, httpTimeout: 5000 });
            const pending = request().catch(error => error);
            while (connections === 0) await delay(5);
            agent.close();
            assert.equal((await pending).name, "WSDriverRequestAgentTerminatedError");
            await delay(50);
            assert.equal(sockets.size, 0);
            assert.equal(requests, 0);
            assert.equal(connections, 1);
        });
    }
});
