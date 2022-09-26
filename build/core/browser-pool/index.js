"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = void 0;
const lodash_1 = __importDefault(require("lodash"));
const bluebird_1 = __importDefault(require("bluebird"));
const basic_pool_1 = __importDefault(require("./basic-pool"));
const caching_pool_1 = __importDefault(require("./caching-pool"));
const limited_pool_1 = __importDefault(require("./limited-pool"));
const per_browser_limited_pool_1 = __importDefault(require("./per-browser-limited-pool"));
function create(browserManager, opts) {
    browserManager = lodash_1.default.defaults(browserManager, {
        onStart: () => bluebird_1.default.resolve(),
        onQuit: () => bluebird_1.default.resolve()
    });
    let pool = basic_pool_1.default.create(browserManager, opts);
    pool = new caching_pool_1.default(pool, opts.config, opts);
    pool = new per_browser_limited_pool_1.default(pool, opts.config, opts);
    // @ts-expect-error
    if (lodash_1.default.isFinite(opts.config.system.parallelLimit)) {
        pool = new limited_pool_1.default(pool, {
            // @ts-expect-error
            limit: opts.config.system.parallelLimit,
            logNamespace: opts.logNamespace,
            isSpecificBrowserLimiter: false
        });
    }
    return pool;
}
exports.create = create;
