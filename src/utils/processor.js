"use strict";

const _ = require("lodash");
const { WORKER_UNHANDLED_REJECTION } = require("../constants/process-messages");
const logger = require("./logger");
const ipc = require("./ipc");
const { shouldIgnoreUnhandledRejection } = require("./errors");
const { utilInspectSafe } = require("./secret-replacer");
const { preloadWebdriverIO, preloadMochaReader } = require("./preload-utils.js");

process.on("unhandledRejection", (reason, p) => {
    if (shouldIgnoreUnhandledRejection(reason)) {
        logger.warn(`Unhandled Rejection "${reason}" in testplane:worker:${process.pid} was ignored`);
        return;
    }

    const error = [
        `Unhandled Rejection in testplane:worker:${process.pid}:`,
        `Promise: ${utilInspectSafe(p)}`,
        `Reason: ${utilInspectSafe(reason)}`,
    ].join("\n");

    ipc.emit(WORKER_UNHANDLED_REJECTION, { error, workerPid: process.pid });
});

preloadWebdriverIO();
preloadMochaReader();

exports.loadModule = (moduleName, cb) => {
    try {
        require(moduleName);
    } catch {} // eslint-disable-line no-empty

    cb(null);
};

exports.execute = async (moduleName, methodName, args, cb) => {
    try {
        const result = await require(moduleName)[methodName](...args);
        cb(null, result);
    } catch (err) {
        sendError(err, cb);
    }
};

function sendError(err, cb) {
    try {
        cb(err);
    } catch {
        const shortenedErr = _.pick(err, [
            "message",
            "stack",
            "code",
            "screenshot",
            // TODO: use fields from worker test-runner after rewrite on TS
            "testplaneCtx",
            "hermioneCtx",
            "meta",
            "history",
        ]);

        cb(shortenedErr);
    }
}
