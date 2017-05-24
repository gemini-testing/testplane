'use strict';
var BasicPool = require('./basic-pool'),
    PerBrowserLimitedPool = require('./per-browser-limited-pool'),
    CachingPool = require('./caching-pool');

/**
 * @param {Config} config
 * @returns {BasicPool}
 */
exports.create = function(config, emitter) {
    let pool = BasicPool.create(config, emitter);

    pool = new CachingPool(config, pool);
    pool = new PerBrowserLimitedPool(config, pool);

    return pool;
};
