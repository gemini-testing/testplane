'use strict';

const q = require('bluebird-q');

// FIXME: remove this adapter after migration from "q" to "bluebird"
module.exports = class QBrowserPool {
    static create(...args) {
        return new QBrowserPool(...args);
    }

    constructor(browserPool) {
        this._browserPool = browserPool;
    }

    getBrowser(...args) {
        return q(this._browserPool.getBrowser(...args));
    }

    freeBrowser(...args) {
        return q(this._browserPool.freeBrowser(...args));
    }

    cancel() {
        return this._browserPool.cancel();
    }
};
