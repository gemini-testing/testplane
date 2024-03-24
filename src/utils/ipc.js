import _ from "lodash";

export const emit = (event, data = {}) => process.send({ event, ...data });
export const on = (event, baseHandler) => {
    process.on("message", (...args) => {
        if (event !== _.get(args[0], "event")) {
            return;
        }

        baseHandler(...args);
    });
};
