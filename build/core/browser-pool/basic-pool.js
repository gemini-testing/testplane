"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bluebird_1 = __importDefault(require("bluebird"));
const debug_1 = __importDefault(require("debug"));
const lodash_1 = __importDefault(require("lodash"));
const cancelled_error_1 = __importDefault(require("../errors/cancelled-error"));
class BasicPool {
    constructor(browserManager, opts) {
        this._browserMgr = browserManager;
        this.log = (0, debug_1.default)(`${opts.logNamespace}:pool:basic`);
        this._activeSessions = {};
    }
    static create(browserManager, opts) {
        return new BasicPool(browserManager, opts);
    }
    async getBrowser(id, opts = {}) {
        const { version } = opts;
        const browser = this._browserMgr.create(id, version);
        await this._browserMgr.start(browser);
        this.log(`browser ${browser.fullId} started`);
        this._browserMgr.onStart(browser);
        if (this._cancelled) {
            return bluebird_1.default.reject(new cancelled_error_1.default());
        }
        this._activeSessions[browser.sessionId] = browser;
        await browser.reset();
        return browser;
    }
    async freeBrowser(browser) {
        delete this._activeSessions[browser.sessionId];
        this.log(`stop browser ${browser.fullId}`);
        try {
            await this._browserMgr.onQuit(browser);
        }
        catch (err) {
            console.warn(err instanceof Error ? err.stack : err);
        }
        return this._browserMgr.quit(browser);
    }
    cancel() {
        this._cancelled = true;
        lodash_1.default.forEach(this._activeSessions, (browser) => this._browserMgr.quit(browser));
        this._activeSessions = {};
    }
}
exports.default = BasicPool;
