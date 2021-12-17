'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const {ScreenShooter, Image, temp} = require('gemini-core');

const RuntimeConfig = require('../../../config/runtime-config');
const logger = require('../../../utils/logger');

module.exports = class OneTimeScreenshooter {
    static create(...args) {
        return new this(...args);
    }

    constructor(config, browser, expandable) {
        this._config = config;
        this._browser = browser;
        this._expandable = expandable;
        this._screenshotTaken = false;

        this._screenshooter = new ScreenShooter(browser);
        this._screenshotTimeout = this._config.screenshotOnRejectTimeout || this._config.httpTimeout;
    }

    async captureScreenshot() {
        if (!this._config.screenshotOnReject || this._expandable.screenshot || this._screenshotTaken) {
            return;
        }

        this._screenshotTaken = true;

        this._browser.setHttpTimeout(this._screenshotTimeout);

        try {
            const msg = `timed out after ${this._screenshotTimeout} ms`;
            const screenshot = await Promise.resolve(this._makeScreenshot())
                .then(image => this._saveImage(image))
                .timeout(this._screenshotTimeout, msg);

            _.assignIn(this._expandable, {screenshot});
        } catch (e) {
            logger.warn(`WARN: Failed to take screenshot on test fail: ${e}`);
        }

        this._browser.restoreHttpTimeout();
    }

    async _makeScreenshot() {
        switch (this._config.screenshotOnRejectMode) {
            case 'fullpage':
                return this._makeFullPageScreenshot();
            case 'viewport':
            default:
                return this._makeViewportScreenshot();
        }
    }

    async _makeFullPageScreenshot() {
        const pageSize = await this._getPageSize();

        const page = await this._browser.prepareScreenshot({
            top: 0,
            left: 0,
            height: pageSize.height,
            width: pageSize.width
        }, {
            ignoreSelectors: [],
            captureElementFromTop: true,
            allowViewportOverflow: true
        });

        return this._screenshooter.capture(page, {
            compositeImage: true,
            allowViewportOverflow: true
        });
    }

    async _getPageSize() {
        return this._browser.evalScript(`{
            height: document.documentElement.scrollHeight,
            width: document.documentElement.scrollWidth
        }`);
    }

    async _makeViewportScreenshot() {
        const base64 = await this._browser.publicAPI.takeScreenshot();

        return Image.fromBase64(base64);
    }

    async _saveImage(image) {
        const {tempOpts} = RuntimeConfig.getInstance();
        temp.attach(tempOpts);

        const imageInfo = {path: temp.path(Object.assign(tempOpts, {suffix: '.png'})), size: image.getSize()};
        await image.save(imageInfo.path);

        return imageInfo;
    }
};
