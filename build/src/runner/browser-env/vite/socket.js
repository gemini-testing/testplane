"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSocketServer = void 0;
const lodash_1 = __importDefault(require("lodash"));
const socket_io_1 = require("socket.io");
const constants_1 = require("./constants");
const constants_2 = require("../../../worker/browser-env/runner/test-runner/constants");
const types_1 = require("./types");
const types_2 = require("../../../worker/browser-env/runner/test-runner/types");
const utils_1 = require("./utils");
const createSocketServer = (viteHttpServer) => {
    const io = new socket_io_1.Server(viteHttpServer);
    io.use((socket, next) => {
        const { runUuid, type, reconnect } = socket.handshake.auth;
        if (!runUuid) {
            return next(new Error('"runUuid" must be specified in each socket request'));
        }
        if (type === constants_2.WORKER_EVENT_PREFIX) {
            return next();
        }
        const roomSocketCount = io.of("/").adapter.rooms.get(runUuid)?.size || 0;
        if (roomSocketCount >= 2) {
            return next(new Error(`Browser with "runUuid=${runUuid}" is already connected to Vite server. To debug, you need to use a browser launched by Testplane`));
        }
        if (type === constants_1.BROWSER_EVENT_PREFIX && reconnect) {
            io.to(runUuid).except(socket.id).emit(types_1.BrowserEventNames.reconnect);
        }
        return next();
    });
    io.on("connection", socket => {
        if (socket.handshake.auth.type === constants_2.WORKER_EVENT_PREFIX) {
            handleWorkerEvents(socket, io);
        }
        if (socket.handshake.auth.type === constants_1.BROWSER_EVENT_PREFIX) {
            handleBrowserEvents(socket, io);
        }
    });
};
exports.createSocketServer = createSocketServer;
function handleWorkerEvents(socket, io) {
    socket.on(types_2.WorkerEventNames.initialize, payload => {
        const { runUuid } = socket.handshake.auth;
        socket.join(runUuid);
        constants_1.WORKER_ENV_BY_RUN_UUID.set(runUuid, payload);
    });
    socket.on(types_2.WorkerEventNames.finalize, () => {
        const { runUuid } = socket.handshake.auth;
        io.socketsLeave(runUuid);
        constants_1.WORKER_ENV_BY_RUN_UUID.delete(socket.handshake.auth.runUuid);
    });
    socket.on(types_2.WorkerEventNames.runRunnable, async (payload, cb) => {
        const { runUuid } = socket.handshake.auth;
        try {
            // specify timeout is not necessary here, but types incorrectly defined without it. So use maximum possible value
            const [errors] = await io
                .to(runUuid)
                .except(socket.id)
                .timeout(constants_1.SOCKET_MAX_TIMEOUT)
                .emitWithAck(types_2.WorkerEventNames.runRunnable, payload);
            cb([(lodash_1.default.isEmpty(errors) ? null : errors[0])]);
        }
        catch (err) {
            cb([(0, utils_1.prepareError)(err)]);
        }
    });
}
function handleBrowserEvents(socket, io) {
    socket.on(types_1.BrowserEventNames.initialize, payload => {
        const { runUuid } = socket.handshake.auth;
        socket.join(runUuid);
        io.to(runUuid).except(socket.id).emit(types_1.BrowserEventNames.initialize, payload);
    });
    socket.on(types_1.BrowserEventNames.callConsoleMethod, payload => {
        const { runUuid } = socket.handshake.auth;
        io.to(runUuid).except(socket.id).emit(types_1.BrowserEventNames.callConsoleMethod, payload);
    });
    socket.on(types_1.BrowserEventNames.runBrowserCommand, async (payload, cb) => {
        const { runUuid } = socket.handshake.auth;
        try {
            const [response] = await io
                .to(runUuid)
                .except(socket.id)
                .timeout(constants_1.SOCKET_MAX_TIMEOUT)
                .emitWithAck(types_1.BrowserEventNames.runBrowserCommand, payload);
            cb(response);
        }
        catch (err) {
            cb([err]);
        }
    });
    socket.on(types_1.BrowserEventNames.runExpectMatcher, async (payload, cb) => {
        const { runUuid } = socket.handshake.auth;
        try {
            const [response] = await io
                .to(runUuid)
                .except(socket.id)
                .timeout(constants_1.SOCKET_MAX_TIMEOUT)
                .emitWithAck(types_1.BrowserEventNames.runExpectMatcher, payload);
            cb(response);
        }
        catch (err) {
            cb([{ pass: false, message: err.message }]);
        }
    });
}
//# sourceMappingURL=socket.js.map