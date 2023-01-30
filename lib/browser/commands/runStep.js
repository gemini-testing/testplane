'use strict';

const _ = require('lodash');

module.exports = (browser) => {
    const {publicAPI: session} = browser;

    function runStep(stepName, stepCb) {
        if (!_.isString(stepName)) {
            throw Error(`First argument (stepName) must be a string, but got ${typeof stepName}`);
        }

        if (!_.isFunction(stepCb)) {
            throw Error(`Second argument (stepCb) must be a function, but got ${typeof stepCb}`);
        }

        return stepCb();
    }

    session.addCommand('runStep', runStep);
};
