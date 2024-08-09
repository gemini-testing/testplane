"use strict";

import _ from "lodash";
import Browser from "../browser";

const addRunStepCommand = (browser: Browser): void => {
    const { publicAPI: session } = browser;
    session.addCommand("runStep", (stepName: string, stepCb: () => void) => {
        if (!_.isString(stepName)) {
            throw Error(`First argument must be a string, but got ${typeof stepName}`);
        }

        if (!_.isFunction(stepCb)) {
            throw Error(`Second argument must be a function, but got ${typeof stepCb}`);
        }

        return stepCb();
    });
};

export default addRunStepCommand;
