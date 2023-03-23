"use strict";

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
    } catch (e) {
        cb(e);
    }
};
