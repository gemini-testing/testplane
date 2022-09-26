import debug from 'debug';
import _ from 'lodash';

import LimitedPool from './limited-pool';

import type {FreeBrowserOpts, GetBrowserOpts, Pool} from '../types/pool';
import type NewBrowser from '../../browser/new-browser';
import type Config from '../../config';

type PerBrowserLimitedPoolOpts = {
    logNamespace: string;
};

export default class PerBrowserLimitedPool implements Pool {
    log: debug.Debugger;
    private _browserPools: Record<string, LimitedPool>;

    constructor(underlyingPool: Pool, config: Config, opts: PerBrowserLimitedPoolOpts) {
        this.log = debug(`${opts.logNamespace}:pool:per-browser-limited`);

        const ids = config.getBrowserIds();

        this._browserPools = _.zipObject(
            ids,
            ids.map((id: string) => LimitedPool.create(underlyingPool, {
                // @ts-expect-error
                limit: config.forBrowser(id).parallelLimit,
                logNamespace: opts.logNamespace
            }))
        );
    }

    getBrowser(id: string, opts: GetBrowserOpts): Promise<NewBrowser> {
        this.log(`request ${id} with opts: ${JSON.stringify(opts)}`);

        return this._browserPools[id].getBrowser(id, opts);
    }

    freeBrowser(browser: NewBrowser, opts: FreeBrowserOpts): Promise<void> {
        this.log(`free ${browser.fullId}`);

        return this._browserPools[browser.id].freeBrowser(browser, opts);
    }

    cancel(): void {
        this.log('cancel');
        _.forEach(this._browserPools, (pool) => pool.cancel());
    }
}
