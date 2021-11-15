import _ from 'lodash';
import Bluebird from 'bluebird';
import { Image } from 'gemini-core';

import * as logger from '../../../utils/logger';

import type { Size } from 'png-img'; 
import type Config from '../../../config';
import type Browser from '../../../browser/existing-browser';

type Base64Screenshot = {
    base64: string;
    size: Size;
};
type ErrorWithScreenshot = Error & {
    screenshot?: Base64Screenshot
};

export default class OneTimeScreenshooter {
    private _config: Config;
    private _browser: Browser;
    private _screenshotTaken: boolean;

    public static create(...args: ConstructorParameters<typeof OneTimeScreenshooter>): OneTimeScreenshooter {
        return new this(...args);
    }

    constructor(config: Config, browser: Browser) {
        this._config = config;
        this._browser = browser;
        this._screenshotTaken = false;
    }

    public async extendWithPageScreenshot(error: ErrorWithScreenshot): Promise<ErrorWithScreenshot> {
        if (!this._config.screenshotOnReject || error.screenshot || this._screenshotTaken) {
            return error;
        }

        this._screenshotTaken = true;

        const screenshotOnRejectTimeout = this._config.screenshotOnRejectTimeout || this._config.httpTimeout;
        this._browser.setHttpTimeout(screenshotOnRejectTimeout);

        try {
            const msg = `timed out after ${screenshotOnRejectTimeout} ms`;
            const base64 = await Bluebird.method(this._browser.publicAPI.takeScreenshot)
                .call(this._browser.publicAPI)
                .timeout(screenshotOnRejectTimeout, msg);

            const size = Image.fromBase64(base64).getSize();

            error = _.extend(error, {screenshot: {base64, size}});
        } catch (e) {
            logger.warn(`WARN: Failed to take screenshot on reject: ${e}`);
        }

        this._browser.restoreHttpTimeout();

        return error;
    }
};
