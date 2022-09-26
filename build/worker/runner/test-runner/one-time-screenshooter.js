'use strict';
const Promise = require('bluebird');
const fs = require('fs');
const Image = require('../../../core/image');
const ScreenShooter = require('../../../core/screen-shooter');
const temp = require('../../../core/temp');
const RuntimeConfig = require('../../../config/runtime-config');
const logger = require('../../../utils/logger');
module.exports = class OneTimeScreenshooter {
    static create(...args) {
        return new this(...args);
    }
    constructor(config, browser) {
        this._config = config;
        this._browser = browser;
        this._screenshot = null;
        this._alreadyTryToScreenshot = false;
        this._screenshooter = new ScreenShooter(browser);
        this._screenshotTimeout = this._config.takeScreenshotOnFailsTimeout || this._config.httpTimeout;
    }
    async extendWithScreenshot(error) {
        if (!error.screenshot && this._config.takeScreenshotOnFails.testFail) {
            await this._captureScreenshot();
            if (this._screenshot) {
                error.screenshot = this._screenshot;
            }
        }
        return error;
    }
    async captureScreenshotOnAssertViewFail() {
        if (!this._config.takeScreenshotOnFails.assertViewFail) {
            return;
        }
        return this._captureScreenshot();
    }
    async _captureScreenshot() {
        if (this._alreadyTryToScreenshot) {
            return;
        }
        this._alreadyTryToScreenshot = true;
        this._browser.setHttpTimeout(this._screenshotTimeout);
        this._screenshot = await Promise.resolve(this._makeScreenshot())
            .timeout(this._screenshotTimeout, `timed out after ${this._screenshotTimeout} ms`)
            .catch((e) => logger.warn(`WARN: Failed to take screenshot on test fail: ${e}`));
        this._browser.restoreHttpTimeout();
    }
    async _makeScreenshot() {
        if (this._config.takeScreenshotOnFailsMode === 'fullpage') {
            return this._makeFullPageScreenshot();
        }
        return this._makeViewportScreenshot();
    }
    async _makeFullPageScreenshot() {
        const pageSize = await this._getPageSize();
        const page = await this._browser.prepareScreenshot([{
                top: 0,
                left: 0,
                width: pageSize.width,
                height: pageSize.height
            }], {
            ignoreSelectors: [],
            captureElementFromTop: true,
            allowViewportOverflow: true
        });
        const image = await this._screenshooter.capture(page, {
            compositeImage: true,
            allowViewportOverflow: true
        });
        return this._saveImage(image);
    }
    async _getPageSize() {
        return this._browser.evalScript(`{
            height: document.documentElement.scrollHeight,
            width: document.documentElement.scrollWidth
        }`);
    }
    async _saveImage(image) {
        const { tempOpts } = RuntimeConfig.getInstance();
        temp.attach(tempOpts);
        const path = temp.path(Object.assign({}, tempOpts, { suffix: '.png' }));
        await image.save(path);
        // read the recorded image to get base64, otherwise we will break the API
        // TODO: need to teach the Image to return base64
        const buffer = await fs.promises.readFile(path);
        return {
            base64: buffer.toString('base64'),
            size: image.getSize()
        };
    }
    async _makeViewportScreenshot() {
        const base64 = await this._browser.publicAPI.takeScreenshot();
        const size = Image.fromBase64(base64).getSize();
        return { base64, size };
    }
    getScreenshot() {
        return this._screenshot;
    }
};
