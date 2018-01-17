'use strict';

const path = require('path');
const _ = require('lodash');

module.exports = class BrowserConfig {
    constructor(id, browserOptions, systemOptions) {
        this.id = id;
        this.system = systemOptions;
        _.extend(this, browserOptions);
    }

    getScreenshotPath(test, stateName) {
        const filename = `${stateName}.png`;
        const {screenshotsDir} = this;

        return _.isFunction(screenshotsDir)
            ? path.resolve(screenshotsDir(test), filename)
            : path.resolve(process.cwd(), screenshotsDir, test.id(), this.id, filename);
    }

    serialize() {
        return _.omit(this, ['system']);
    }
};
