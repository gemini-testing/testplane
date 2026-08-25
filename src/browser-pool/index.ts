import _ from "lodash";
import { BasicPool } from "./basic-pool";
import { LimitedPool } from "./limited-pool";
import { PerBrowserLimitedPool } from "./per-browser-limited-pool";
import { CachingPool } from "./caching-pool";
import { Config } from "../config";
import { AsyncEmitter } from "../events";
import { ProfilerPoolObserver } from "../profiler/collectors/pool-observer";
import { noopProfilerRuntime } from "../profiler/runtime/noop";
import type { ProfilerRuntimeLike } from "../profiler/runtime/types";
import type { PoolObserver } from "./types";

export type BrowserPool = LimitedPool | PerBrowserLimitedPool;

export const create = function (
    config: Config,
    emitter: AsyncEmitter,
    profiler: ProfilerRuntimeLike = noopProfilerRuntime,
): BrowserPool {
    const observer: PoolObserver | undefined = profiler.isEnabled() ? new ProfilerPoolObserver(profiler) : undefined;
    let pool: BasicPool | CachingPool | PerBrowserLimitedPool | LimitedPool = BasicPool.create(
        config,
        emitter,
        observer,
    );

    pool = new CachingPool(pool, config, observer);
    pool = new PerBrowserLimitedPool(pool, config, observer);

    if (_.isFinite(config.system.parallelLimit)) {
        pool = new LimitedPool(pool, {
            limit: config.system.parallelLimit,
            isSpecificBrowserLimiter: false,
            ...(observer && { observer }),
        });
    }

    return pool;
};
