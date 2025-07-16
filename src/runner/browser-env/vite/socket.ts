import http from "node:http";
import _ from "lodash";
import { Server as SocketServer, type Socket, type Server } from "socket.io";

import { WORKER_ENV_BY_RUN_UUID, SOCKET_MAX_TIMEOUT, BROWSER_EVENT_PREFIX } from "./constants";
import { WORKER_EVENT_PREFIX } from "../../../worker/browser-env/runner/test-runner/constants";
import { BrowserEventNames } from "./types";
import { WorkerEventNames } from "../../../worker/browser-env/runner/test-runner/types";
import { prepareError } from "./utils";

import type { ViteDevServer } from "vite";
import type { BrowserViteEvents, WorkerViteEvents, ViteBrowserEvents } from "./browser-modules/types";

interface ClientViteEvents extends BrowserViteEvents, WorkerViteEvents {}
interface ViteClientEvents extends BrowserViteEvents, ViteBrowserEvents {}

interface SocketHandshakeAuth {
    runUuid: string;
    type: typeof BROWSER_EVENT_PREFIX | typeof WORKER_EVENT_PREFIX;
    reconnect?: boolean;
}

export const createSocketServer = (viteHttpServer: ViteDevServer["httpServer"]): void => {
    const io = new SocketServer<ClientViteEvents, ViteClientEvents>(viteHttpServer as http.Server);

    io.use((socket, next) => {
        const { runUuid, type, reconnect } = socket.handshake.auth as SocketHandshakeAuth;

        if (!runUuid) {
            return next(new Error('"runUuid" must be specified in each socket request'));
        }

        if (type === WORKER_EVENT_PREFIX) {
            return next();
        }

        const roomSocketCount = io.of("/").adapter.rooms.get(runUuid)?.size || 0;

        if (roomSocketCount >= 2) {
            return next(
                new Error(
                    `Browser with "runUuid=${runUuid}" is already connected to Vite server. To debug, you need to use a browser launched by Testplane`,
                ),
            );
        }

        if (type === BROWSER_EVENT_PREFIX && reconnect) {
            io.to(runUuid).except(socket.id).emit(BrowserEventNames.reconnect);
        }

        return next();
    });

    io.on("connection", socket => {
        if (socket.handshake.auth.type === WORKER_EVENT_PREFIX) {
            handleWorkerEvents(socket, io);
        }

        if (socket.handshake.auth.type === BROWSER_EVENT_PREFIX) {
            handleBrowserEvents(socket, io);
        }
    });
};

function handleWorkerEvents(
    socket: Socket<ClientViteEvents, ViteClientEvents>,
    io: Server<ClientViteEvents, ViteClientEvents>,
): void {
    socket.on(WorkerEventNames.initialize, (payload, cb) => {
        try {
            const { runUuid } = socket.handshake.auth;
            socket.join(runUuid);

            WORKER_ENV_BY_RUN_UUID.set(runUuid, payload);

            cb(null);
        } catch (err) {
            cb(prepareError(err as Error));
        }
    });

    socket.on(WorkerEventNames.finalize, () => {
        const { runUuid } = socket.handshake.auth;
        io.socketsLeave(runUuid);

        WORKER_ENV_BY_RUN_UUID.delete(socket.handshake.auth.runUuid);
    });

    socket.on(WorkerEventNames.runRunnable, async (payload, cb) => {
        const { runUuid } = socket.handshake.auth;

        try {
            // specify timeout is not necessary here, but types incorrectly defined without it. So use maximum possible value
            const [errors] = await io
                .to(runUuid)
                .except(socket.id)
                .timeout(SOCKET_MAX_TIMEOUT)
                .emitWithAck(WorkerEventNames.runRunnable, payload);

            cb([(_.isEmpty(errors) ? null : errors![0]) as Error]);
        } catch (err) {
            cb([prepareError(err as Error)]);
        }
    });
}

function handleBrowserEvents(
    socket: Socket<ClientViteEvents, ViteClientEvents>,
    io: Server<ClientViteEvents, ViteClientEvents>,
): void {
    socket.on(BrowserEventNames.initialize, payload => {
        const { runUuid } = socket.handshake.auth;
        socket.join(runUuid);

        io.to(runUuid).except(socket.id).emit(BrowserEventNames.initialize, payload);
    });

    socket.on(BrowserEventNames.callConsoleMethod, payload => {
        const { runUuid } = socket.handshake.auth;

        io.to(runUuid).except(socket.id).emit(BrowserEventNames.callConsoleMethod, payload);
    });

    socket.on(BrowserEventNames.runBrowserCommand, async (payload, cb) => {
        const { runUuid } = socket.handshake.auth;

        try {
            const [response] = await io
                .to(runUuid)
                .except(socket.id)
                .timeout(SOCKET_MAX_TIMEOUT)
                .emitWithAck(BrowserEventNames.runBrowserCommand, payload);

            cb(response);
        } catch (err) {
            cb([err as Error]);
        }
    });

    socket.on(BrowserEventNames.runExpectMatcher, async (payload, cb) => {
        const { runUuid } = socket.handshake.auth;

        try {
            const [response] = await io
                .to(runUuid)
                .except(socket.id)
                .timeout(SOCKET_MAX_TIMEOUT)
                .emitWithAck(BrowserEventNames.runExpectMatcher, payload);

            cb(response);
        } catch (err) {
            cb([{ pass: false, message: (err as Error).message }]);
        }
    });
}
