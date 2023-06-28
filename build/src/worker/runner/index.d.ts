export = Runner;
declare class Runner extends AsyncEmitter {
    static create(config: any): import(".");
    constructor(config: any);
    _config: any;
    _browserPool: BrowserPool;
    _testParser: CachingTestParser;
    runTest(fullTitle: any, { browserId, browserVersion, file, sessionId, sessionCaps, sessionOpts }: {
        browserId: any;
        browserVersion: any;
        file: any;
        sessionId: any;
        sessionCaps: any;
        sessionOpts: any;
    }): Promise<{
        hermioneCtx: any;
        meta: any;
    }>;
}
import { AsyncEmitter } from "../../events/async-emitter";
import BrowserPool = require("./browser-pool");
import CachingTestParser = require("./caching-test-parser");
