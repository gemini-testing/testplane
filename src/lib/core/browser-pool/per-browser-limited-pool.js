'use strict';

const _ = require('lodash');
const Pool = require('./pool');
const LimitedPool = require('./limited-pool');
const debug = require('debug');

module.exports = class PerBrowserLimitedPool extends Pool {
    constructor(underlyingPool, config, opts) {
        super();

        this.log = debug(`${opts.logNamespace}:pool:per-browser-limited`);

        const ids = config.getBrowserIds();
        this._browserPools = _.zipObject(
            ids,
            ids.map((id) => LimitedPool.create(underlyingPool, {
                limit: config.forBrowser(id).parallelLimit,
                logNamespace: opts.logNamespace
            }))
        );
    }

    getBrowser(id, opts) {
        this.log(`request ${id} with opts: ${JSON.stringify(opts)}`);

        return this._browserPools[id].getBrowser(id, opts);
    }

    freeBrowser(browser, opts) {
        this.log(`free ${browser.fullId}`);

        return this._browserPools[browser.id].freeBrowser(browser, opts);
    }

    cancel() {
        this.log('cancel');
        _.forEach(this._browserPools, (pool) => pool.cancel());
    }
};
