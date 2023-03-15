"use strict";

const _ = require("lodash");

module.exports = browser => {
    const { publicAPI: session } = browser;
    session.addCommand("runStep", (stepName, stepCb) => {
        if (!_.isString(stepName)) {
            throw Error(`First argument must be a string, but got ${typeof stepName}`);
        }

        if (!_.isFunction(stepCb)) {
            throw Error(`Second argument must be a function, but got ${typeof stepCb}`);
        }

        return stepCb();
    });
};
