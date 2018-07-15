'use strict';

const _ = require('lodash');
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
            const {value: screenshot} = await this._browser.publicAPI.screenshot();
            error = _.extend(error, {screenshot});
        } catch (e) {
            logger.warn(`WARN: Failed to take screenshot on reject: ${e}`);
        }

        this._browser.restoreHttpTimeout();

        return error;
    }
};
