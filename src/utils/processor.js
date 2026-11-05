"use strict";

const _ = require("lodash");
const { WORKER_UNHANDLED_REJECTION } = require("../constants/process-messages");
const debug = require("debug")("testplane:worker:processor");
const logger = require("./logger");
const ipc = require("./ipc");
const { shouldIgnoreUnhandledRejection } = require("./errors");
const { utilInspectSafe } = require("./secret-replacer");
const { preloadWebdriverIO, preloadMochaReader } = require("./preload-utils.js");
const { serializeWorkerError } = require("./worker-error-serialization");

process.on("uncaughtException", err => {
    if (err.code === "EPIPE" || err.code === "ERR_IPC_CHANNEL_CLOSED") {
        debug(
            "The following error was ignored in worker, because we tried to send message to master process, but it has already exited",
        );
        debug(err);
        return;
    }
    throw err;
});

process.on("unhandledRejection", reason => {
    if (shouldIgnoreUnhandledRejection(reason)) {
        logger.warn(`Unhandled Rejection "${reason}" in testplane:worker:${process.pid} was ignored`);
        return;
    }

    const error = [
        `Unhandled Rejection in testplane:worker:${process.pid}:`,
        `Reason: ${utilInspectSafe(reason)}`,
    ].join("\n");

    ipc.emit(WORKER_UNHANDLED_REJECTION, { error, workerPid: process.pid });
});

// Mocha may synchronously require ESM dependencies also imported by WebdriverIO.
// Finish one module graph before starting the other to avoid partial ESM cache entries.
const preloadModules = preloadWebdriverIO().then(() => preloadMochaReader());

exports.loadModule = async (moduleName, cb) => {
    try {
        await preloadModules;
        require(moduleName);
    } catch {} // eslint-disable-line no-empty

    cb(null);
};

exports.execute = async (moduleName, methodName, args, cb) => {
    try {
        await preloadModules;
        const result = await require(moduleName)[methodName](...args);
        cb(null, result);
    } catch (err) {
        sendError(err, cb);
    }
};

function sendError(err, cb) {
    try {
        cb(serializeWorkerError(err));
    } catch {
        const shortenedErr = _.pick(err || {}, [
            "message",
            "stack",
            "code",
            "screenshot",
            // TODO: use fields from worker test-runner after rewrite on TS
            "testplaneCtx",
            "hermioneCtx",
            "meta",
            "history",
            "profileFragment",
        ]);

        cb(serializeWorkerError(shortenedErr));
    }
}
