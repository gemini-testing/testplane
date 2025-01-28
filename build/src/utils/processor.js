"use strict";
const _ = require("lodash");
const util = require("util");
const { WORKER_UNHANDLED_REJECTION } = require("../constants/process-messages");
const logger = require("./logger");
const ipc = require("./ipc");
const { shouldIgnoreUnhandledRejection } = require("./errors");
process.on("unhandledRejection", (reason, p) => {
    if (shouldIgnoreUnhandledRejection(reason)) {
        logger.warn(`Unhandled Rejection "${reason}" in testplane:worker:${process.pid} was ignored`);
        return;
    }
    const error = [
        `Unhandled Rejection in testplane:worker:${process.pid}:`,
        `Promise: ${util.inspect(p)}`,
        `Reason: ${util.inspect(reason)}`,
    ].join("\n");
    ipc.emit(WORKER_UNHANDLED_REJECTION, { error });
});
module.exports = async (module, methodName, args, cb) => {
    try {
        const result = await require(module)[methodName](...args);
        cb(null, result);
    }
    catch (err) {
        sendError(err, cb);
    }
};
function sendError(err, cb) {
    try {
        cb(err);
    }
    catch {
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
//# sourceMappingURL=processor.js.map