"use strict";
const _ = require("lodash");
module.exports = {
    emit: (event, data = {}) => process.send(Object.assign({ event }, data)),
    on: (event, baseHandler) => {
        process.on("message", (...args) => {
            if (event !== _.get(args[0], "event")) {
                return;
            }
            baseHandler(...args);
        });
    },
};
//# sourceMappingURL=ipc.js.map