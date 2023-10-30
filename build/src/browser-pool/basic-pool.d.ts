export = BasicPool;
declare class BasicPool extends Pool {
    static create(config: any, emitter: any): import("./basic-pool");
    constructor(config: any, emitter: any);
    _config: any;
    _emitter: any;
    log: any;
    _activeSessions: {};
    getBrowser(id: any, opts?: {}): Promise<import("../browser/browser")>;
    freeBrowser(browser: any): Promise<void>;
    _emit(event: any, browser: any): any;
    _cancelled: boolean | undefined;
}
import Pool = require("./pool");
