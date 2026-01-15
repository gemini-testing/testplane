"use strict";

const _ = require("lodash");
const debug = require("debug")("testplane:worker:ipc");

module.exports = {
    emit: (event, data = {}) => {
        try {
            process.send({ event, ...data });
        } catch (error) {
            // This error happens when master has already shut down, so we can't send anything anyways
            if (error.code === "ERR_IPC_CHANNEL_CLOSED") {
                debug("Ignoring IPC channel closed error:");
                debug(error);
                return;
            }
            throw error;
        }
    },
    on: (event, baseHandler) => {
        process.on("message", (...args) => {
            if (event !== _.get(args[0], "event")) {
                return;
            }

            baseHandler(...args);
        });
    },
};
