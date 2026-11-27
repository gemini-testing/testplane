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
    const { parallelLimit } = config.system;
    const hasGlobalLimit = _.isFinite(parallelLimit);
    let pool: BasicPool | CachingPool | PerBrowserLimitedPool | LimitedPool = BasicPool.create(
        {
            browserDownloadMirrors: config.browserDownloadMirrors,
            areLocalWdDebugLogsEnabled: config.system.debug,
        },
        emitter,
        observer,
    );

    pool = new CachingPool(pool, observer, hasGlobalLimit ? parallelLimit : undefined);
    pool = new PerBrowserLimitedPool(pool, config, observer, hasGlobalLimit);

    if (hasGlobalLimit) {
        pool = new LimitedPool(pool, {
            limit: parallelLimit,
            isSpecificBrowserLimiter: false,
            ...(observer && { observer }),
        });
    }

    return pool;
};
