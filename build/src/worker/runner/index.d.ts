export = Runner;
declare class Runner extends AsyncEmitter {
    static create(config: any): import(".");
    constructor(config: any);
    _config: any;
    _browserPool: BrowserPool;
    _testParser: CachingTestParser;
    runTest(fullTitle: any, { browserId, browserVersion, file, sessionId, sessionCaps, sessionOpts, state }: {
        browserId: any;
        browserVersion: any;
        file: any;
        sessionId: any;
        sessionCaps: any;
        sessionOpts: any;
        state: any;
    }): Promise<{
        testplaneCtx: any;
        hermioneCtx: any;
        meta: any;
    }>;
}
import { AsyncEmitter } from "../../events/async-emitter";
import BrowserPool = require("./browser-pool");
import { CachingTestParser } from "./caching-test-parser";
