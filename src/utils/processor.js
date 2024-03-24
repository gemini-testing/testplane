import _ from "lodash";
import { WORKER_UNHANDLED_REJECTION } from "../constants/process-messages.js";
import logger from "./logger.js";
import ipc from "./ipc.js";
import { shouldIgnoreUnhandledRejection } from "./errors.js";

process.on("unhandledRejection", (reason, p) => {
    if (shouldIgnoreUnhandledRejection(reason)) {
        logger.warn(`Unhandled Rejection "${reason}" in hermione:worker:${process.pid} was ignored`);
        return;
    }

    const error = [
        `Unhandled Rejection in hermione:worker:${process.pid}:`,
        `Promise: ${JSON.stringify(p)}`,
        `Reason: ${_.get(reason, "stack", reason)}`,
    ].join("\n");

    ipc.emit(WORKER_UNHANDLED_REJECTION, { error });
});

export default async (module, methodName, args, cb) => {
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
