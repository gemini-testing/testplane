import { Calibrator } from 'gemini-core';
import _ from 'lodash';

import RunnerEvents from '../constants/runner-events';
import Browser from '../../browser/existing-browser';
import ipc from '../../utils/ipc';

import type { events } from 'gemini-core';
import type Config from '../../config';

export default class BrowserPool {
    private _config: Config;
    private _emitter: events.AsyncEmitter;
    private _browsers: {
        [browserId: string]: Array<Browser>;
    };
    private _calibrator: Calibrator;

    public static create(config: Config, emitter: events.AsyncEmitter): BrowserPool {
        return new BrowserPool(config, emitter);
    }

    constructor(config: Config, emitter: events.AsyncEmitter) {
        this._config = config;
        this._emitter = emitter;
        this._browsers = {};
        this._calibrator = new Calibrator();
    }

    public async getBrowser({browserId, browserVersion, sessionId, sessionCaps, sessionOpts}): Promise<Browser> {
        this._browsers[browserId] = this._browsers[browserId] || [];

        let browser = _.find(this._browsers[browserId], (browser) => {
            return browserVersion
                ? _.isNil(browser.sessionId) && browser.version === browserVersion
                : _.isNil(browser.sessionId);
        });

        try {
            if (browser) {
                return await browser.reinit(sessionId, sessionOpts);
            }

            browser = Browser.create(this._config, browserId, browserVersion, this._emitter);
            await browser.init({sessionId, sessionCaps, sessionOpts}, this._calibrator);

            this._browsers[browserId].push(browser);

            this._emitter.emit(RunnerEvents.NEW_BROWSER, browser.publicAPI, {browserId: browser.id, browserVersion});

            return browser;
        } catch (error) {
            if (!browser) {
                throw error;
            }

            browser.sessionId = sessionId;
            browser.markAsBroken();
            this.freeBrowser(browser);

            throw Object.assign(error, {meta: browser.meta});
        }
    }

    public freeBrowser(browser: Browser): void {
        ipc.emit(`worker.${browser.sessionId}.freeBrowser`, browser.state);

        if (browser.state.isBroken) {
            _.pull(this._browsers[browser.id], browser);
        }

        browser.quit();
    }
};
