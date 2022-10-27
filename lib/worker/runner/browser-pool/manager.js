'use strict';

const BasicBrowserPool = require('./basic');
const CachingBrowserPool = require('./caching');
const {DEVTOOLS_PROTOCOL} = require('../../../constants/config');

module.exports = class BrowserPoolManager {
    static create(...args) {
        return new this(...args);
    }

    constructor(...args) {
        this._basicBrowserPool = BasicBrowserPool.create(...args);
        this._cachingBrowserPool = CachingBrowserPool.create(...args);
    }

    getPool(browserConfig) {
        return browserConfig.automationProtocol === DEVTOOLS_PROTOCOL
            ? this._basicBrowserPool
            : this._cachingBrowserPool;
    }
};
