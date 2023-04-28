"use strict";

const _ = require("lodash");
const { WORKER_UNHANDLED_REJECTION } = require("../constants/process-messages");
const ipc = require("./ipc");

process.on("unhandledRejection", (reason, p) => {
    const error = `Unhandled Rejection in hermione:worker:${process.pid}:\nPromise: ${JSON.stringify(
        p,
    )}\nReason: ${reason}`;

    ipc.emit(WORKER_UNHANDLED_REJECTION, { error });
});

module.exports = async (module, methodName, args, cb) => {
    try {
        const result = await require(module)[methodName](...args);
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
            "hermioneCtx",
            "meta",
            "history",
        ]);

        cb(shortenedErr);
    }
}
