//TODO
import { BrowserAgent as BaseBrowserAgent } from 'gemini-core';

import type { Pool } from 'gemini-core/lib/types/pool';

export default class BrowserAgent {
    private _version: string;
    private _agent: BaseBrowserAgent;

    public static create(id: string, version: string, pool: Pool): BrowserAgent {
        return new this(id, version, pool);
    }

    constructor(id: string, version: string, pool: Pool) {
        this._version = version;
        this._agent = BaseBrowserAgent.create(id, pool);
    }

    public getBrowser(opts: {version?: string} = {}) {
        opts.version = this._version;

        return this._agent.getBrowser(opts);
    }

    public async freeBrowser(browser): Promise<void> {
        return this._agent.freeBrowser(browser, {force: browser.state.isBroken});
    }

    get browserId(): string {
        return this._agent.browserId;
    }
};
