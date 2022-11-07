'use strict';
const _ = require('lodash');
const Promise = require('bluebird');
const BasicPool = require('./basic-pool');
const LimitedPool = require('./limited-pool');
const PerBrowserLimitedPool = require('./per-browser-limited-pool');
const CachingPool = require('./caching-pool');
/**
 * @param {Object} BrowserManager
 * @param {Function} BrowserManager.start
 * @param {Function} BrowserManager.onStart
 * @param {Function} BrowserManager.onQuit
 * @param {Function} BrowserManager.quit
 * @returns {BasicPool}
 */
exports.create = function (BrowserManager, opts) {
    BrowserManager = _.defaults(BrowserManager, {
        onStart: () => Promise.resolve(),
        onQuit: () => Promise.resolve()
    });
    var pool = BasicPool.create(BrowserManager, opts);
    pool = new CachingPool(pool, opts.config, opts);
    pool = new PerBrowserLimitedPool(pool, opts.config, opts);
    if (_.isFinite(opts.config.system.parallelLimit)) {
        pool = new LimitedPool(pool, {
            limit: opts.config.system.parallelLimit,
            logNamespace: opts.logNamespace,
            isSpecificBrowserLimiter: false
        });
    }
    return pool;
};
