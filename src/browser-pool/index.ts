"use strict";

const _ = require("lodash");
const BasicPool = require("./basic-pool");
const LimitedPool = require("./limited-pool");
const PerBrowserLimitedPool = require("./per-browser-limited-pool");
const CachingPool = require("./caching-pool");

exports.create = function (config, emitter) {
    var pool = BasicPool.create(config, emitter);

    pool = new CachingPool(pool, config);
    pool = new PerBrowserLimitedPool(pool, config);

    if (_.isFinite(config.system.parallelLimit)) {
        pool = new LimitedPool(pool, {
            limit: config.system.parallelLimit,
            isSpecificBrowserLimiter: false,
        });
    }

    return pool;
};
