"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = void 0;
const lodash_1 = __importDefault(require("lodash"));
const basic_pool_1 = require("./basic-pool");
const limited_pool_1 = require("./limited-pool");
const per_browser_limited_pool_1 = require("./per-browser-limited-pool");
const caching_pool_1 = require("./caching-pool");
const create = function (config, emitter) {
    let pool = basic_pool_1.BasicPool.create(config, emitter);
    pool = new caching_pool_1.CachingPool(pool, config);
    pool = new per_browser_limited_pool_1.PerBrowserLimitedPool(pool, config);
    if (lodash_1.default.isFinite(config.system.parallelLimit)) {
        pool = new limited_pool_1.LimitedPool(pool, {
            limit: config.system.parallelLimit,
            isSpecificBrowserLimiter: false,
        });
    }
    return pool;
};
exports.create = create;
//# sourceMappingURL=index.js.map