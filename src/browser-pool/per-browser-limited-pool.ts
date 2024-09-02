import debug from "debug";
import { zipObject, forEach } from "lodash";

import { Pool } from "./types";
import { Config } from "../config";
import { Browser } from "../browser/browser";
import { LimitedPool } from "./limited-pool";

export class PerBrowserLimitedPool implements Pool {
    log: debug.Debugger;
    private _browserPools: Record<string, LimitedPool>;

    constructor(underlyingPool: Pool, config: Config) {
        this.log = debug("testplane:pool:per-browser-limited");

        const ids = config.getBrowserIds();
        this._browserPools = zipObject(
            ids,
            ids.map(id =>
                LimitedPool.create(underlyingPool, {
                    limit: config.forBrowser(id).sessionsPerBrowser,
                }),
            ),
        );
    }

    getBrowser(id: string, opts?: object): Promise<Browser> {
        this.log(`request ${id} with opts: ${JSON.stringify(opts)}`);

        return this._browserPools[id].getBrowser(id, opts);
    }

    freeBrowser(browser: Browser, opts?: object): Promise<void> {
        this.log(`free ${browser.fullId}`);

        return this._browserPools[browser.id].freeBrowser(browser, opts);
    }

    cancel(): void {
        this.log("cancel");
        forEach(this._browserPools, pool => pool.cancel());
    }
}
