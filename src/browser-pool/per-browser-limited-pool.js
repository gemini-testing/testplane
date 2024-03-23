import _ from "lodash";
import debug from "debug";
import Pool from "./pool.js";
import LimitedPool from "./limited-pool.js";

export default class PerBrowserLimitedPool extends Pool {
    constructor(underlyingPool, config) {
        super();

        this.log = debug("hermione:pool:per-browser-limited");

        const ids = config.getBrowserIds();
        this._browserPools = _.zipObject(
            ids,
            ids.map(id =>
                LimitedPool.create(underlyingPool, {
                    limit: config.forBrowser(id).sessionsPerBrowser,
                }),
            ),
        );
    }

    getBrowser(id, opts) {
        this.log(`request ${id} with opts: ${JSON.stringify(opts)}`);

        return this._browserPools[id].getBrowser(id, opts);
    }

    freeBrowser(browser, opts) {
        this.log(`free ${browser.fullId}`);

        return this._browserPools[browser.id].freeBrowser(browser, opts);
    }

    cancel() {
        this.log("cancel");
        _.forEach(this._browserPools, pool => pool.cancel());
    }
}
