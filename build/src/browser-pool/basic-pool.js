"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicPool = void 0;
const debug_1 = __importDefault(require("debug"));
const lodash_1 = __importDefault(require("lodash"));
const new_browser_1 = require("../browser/new-browser");
const cancelled_error_1 = require("./cancelled-error");
const events_1 = require("../events");
const webdriver_pool_1 = require("./webdriver-pool");
class BasicPool {
    static create(config, emitter) {
        return new BasicPool(config, emitter);
    }
    constructor(config, emitter) {
        this._config = config;
        this._emitter = emitter;
        this.log = (0, debug_1.default)("testplane:pool:basic");
        this._activeSessions = {};
        this._cancelled = false;
        this._wdPool = new webdriver_pool_1.WebdriverPool();
    }
    async getBrowser(id, opts = {}) {
        const browser = new_browser_1.NewBrowser.create(this._config, { ...opts, id, wdPool: this._wdPool });
        try {
            await browser.init();
            this.log(`browser ${browser.fullId} started`);
            await this._emit(events_1.MasterEvents.SESSION_START, browser);
            if (this._cancelled) {
                throw new cancelled_error_1.CancelledError();
            }
            await browser.reset();
            this._activeSessions[browser.sessionId] = browser;
            return browser;
        }
        catch (e) {
            if (browser.publicAPI) {
                await this.freeBrowser(browser);
            }
            throw e;
        }
    }
    async freeBrowser(browser) {
        delete this._activeSessions[browser.sessionId];
        this.log(`stop browser ${browser.fullId}`);
        try {
            await this._emit(events_1.MasterEvents.SESSION_END, browser);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (err) {
            console.warn((err && err.stack) || err);
        }
        await browser.quit();
    }
    _emit(event, browser) {
        return this._emitter.emitAndWait(event, browser.publicAPI, {
            browserId: browser.id,
            sessionId: browser.sessionId,
        });
    }
    cancel() {
        this._cancelled = true;
        lodash_1.default.forEach(this._activeSessions, browser => browser.quit());
        this._activeSessions = {};
    }
}
exports.BasicPool = BasicPool;
//# sourceMappingURL=basic-pool.js.map