'use strict';

const _ = require('lodash');
const {Image} = require('gemini-core');
const logger = require('../../../utils/logger');

module.exports = class OneTimeScreenshooter {
    static create(...args) {
        return new this(...args);
    }

    constructor(config, browser) {
        this._config = config;
        this._browser = browser;
        this._screenshotTaken = false;
    }

    async extendWithPageScreenshot(error) {
        if (!this._config.screenshotOnReject || error.screenshot || this._screenshotTaken) {
            return error;
        }

        this._screenshotTaken = true;
        this._browser.setHttpTimeout(this._config.screenshotOnRejectTimeout);

        try {
            const base64 = await this._browser.publicAPI.takeScreenshot();
            const size = Image.fromBase64(base64).getSize();

            error = _.extend(error, {screenshot: {base64, size}});
        } catch (e) {
            logger.warn(`WARN: Failed to take screenshot on reject: ${e}`);
        }

        this._browser.restoreHttpTimeout();

        return error;
    }
};
