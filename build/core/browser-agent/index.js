"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
class BrowserAgent {
    constructor(browserId, _pool) {
        this.browserId = browserId;
        this._pool = _pool;
        this._sessions = [];
    }
    static create(browserId, pool) {
        return new BrowserAgent(browserId, pool);
    }
    async getBrowser(opts) {
        const browser = await this._pool.getBrowser(this.browserId, opts);
        if (lodash_1.default.includes(this._sessions, browser.sessionId)) {
            await this.freeBrowser(browser, { force: true });
            return this.getBrowser(opts);
        }
        this._sessions.push(browser.sessionId);
        return browser;
    }
    async freeBrowser(browser, opts) {
        return this._pool.freeBrowser(browser, opts);
    }
}
exports.default = BrowserAgent;
