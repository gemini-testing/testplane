'use strict';

const q = require('bluebird-q');

// FIXME: remove this adapter after migration from "q" to "bluebird"
module.exports = class QBrowserPool {
    static create(browserPool) {
        return new QBrowserPool(browserPool);
    }

    constructor(browserPool) {
        this._browserPool = browserPool;
    }

    getBrowser(id) {
        return q(this._browserPool.getBrowser(id));
    }

    freeBrowser(browser) {
        return q(this._browserPool.freeBrowser(browser));
    }

    cancel() {
        return this._browserPool.cancel();
    }
};
