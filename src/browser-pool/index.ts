import _ from "lodash";
import BasicPool from "./basic-pool.js";
import LimitedPool from "./limited-pool.js";
import PerBrowserLimitedPool from "./per-browser-limited-pool.js";
import CachingPool from "./caching-pool.js";
import { Config } from "../config/index.js";
import { AsyncEmitter } from "../events/index.js";

export type BrowserPool = LimitedPool | PerBrowserLimitedPool;

export const create = function (config: Config, emitter: AsyncEmitter): BrowserPool {
    let pool: BasicPool | CachingPool | PerBrowserLimitedPool | LimitedPool = BasicPool.create(config, emitter);

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
