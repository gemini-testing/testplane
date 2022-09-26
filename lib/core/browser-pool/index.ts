import _ from 'lodash';
import Bluebird from 'bluebird';

import BasicPool from './basic-pool';
import CachingPool from './caching-pool';
import LimitedPool from './limited-pool';
import PerBrowserLimitedPool from './per-browser-limited-pool';

import type {BrowserManager, Pool} from '../types/pool';
import type Config from '../../config';

type CreatePoolOpts = {
    config: Config;
    logNamespace: string;
};

export function create(browserManager: BrowserManager, opts: CreatePoolOpts): Pool {
    browserManager = _.defaults(browserManager, {
        onStart: () => Bluebird.resolve(),
        onQuit: () => Bluebird.resolve()
    });

    let pool: Pool = BasicPool.create(browserManager, opts);

    pool = new CachingPool(pool, opts.config, opts);
    pool = new PerBrowserLimitedPool(pool, opts.config, opts);

            // @ts-expect-error
    if (_.isFinite(opts.config.system.parallelLimit)) {
        pool = new LimitedPool(pool, {
            // @ts-expect-error
            limit: opts.config.system.parallelLimit,
            logNamespace: opts.logNamespace,
            isSpecificBrowserLimiter: false
        });
    }

    return pool;
}
