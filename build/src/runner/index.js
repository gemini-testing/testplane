"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainRunner = void 0;
const lodash_1 = __importDefault(require("lodash"));
const eventsUtils = __importStar(require("../events/utils"));
const temp = __importStar(require("../temp"));
const pool = __importStar(require("../browser-pool"));
const browser_runner_1 = require("./browser-runner");
const events_1 = require("../events");
const runner_1 = require("./runner");
const runtime_config_1 = __importDefault(require("../config/runtime-config"));
const workers_registry_1 = __importDefault(require("../utils/workers-registry"));
const promise_group_1 = __importDefault(require("./promise-group"));
const test_collection_1 = require("../test-collection");
const logger = __importStar(require("../utils/logger"));
class MainRunner extends runner_1.Runner {
    constructor(config, interceptors) {
        super();
        this.config = config;
        this.interceptors = interceptors;
        this.browserPool = null;
        this.activeBrowserRunners = new Map();
        this.running = new promise_group_1.default();
        this.runned = false;
        this.cancelled = false;
        this.workersRegistry = workers_registry_1.default.create(this.config);
        this.workers = null;
        eventsUtils.passthroughEvent(this.workersRegistry, this, [events_1.MasterEvents.NEW_WORKER_PROCESS, events_1.MasterEvents.ERROR]);
        temp.init(this.config.system.tempDir);
        runtime_config_1.default.getInstance().extend({ tempOpts: temp.serialize() });
    }
    init() {
        if (this.workers) {
            return;
        }
        this.workersRegistry.init();
        this.workers = this.workersRegistry.register(require.resolve("../worker"), ["runTest", "cancel"]);
        this.browserPool = pool.create(this.config, this);
    }
    _isRunning() {
        return this.runned && !this.workersRegistry.isEnded() && !this.cancelled;
    }
    async run(testCollection, stats) {
        this.runned = true;
        try {
            await this.emitAndWait(events_1.MasterEvents.RUNNER_START, this);
            this.emit(events_1.MasterEvents.BEGIN);
            !this.cancelled && (await this._runTests(testCollection));
        }
        finally {
            this.emit(events_1.MasterEvents.END);
            await this.emitAndWait(events_1.MasterEvents.RUNNER_END, stats.getResult()).catch(logger.warn);
            await this.workersRegistry.end();
        }
    }
    addTestToRun(test, browserId) {
        if (!this._isRunning() || this.running.isFulfilled()) {
            return false;
        }
        const runner = this.activeBrowserRunners.get(browserId);
        if (runner && runner.addTestToRun(test)) {
            return true;
        }
        const collection = test_collection_1.TestCollection.create({ [browserId]: [test] });
        this.running.add(this._runTestsInBrowser(collection, browserId));
        return true;
    }
    async _runTests(testCollection) {
        testCollection.getBrowsers().forEach((browserId) => {
            this.running.add(this._runTestsInBrowser(testCollection, browserId));
        });
        return this.running.done();
    }
    async _runTestsInBrowser(testCollection, browserId) {
        const runner = browser_runner_1.BrowserRunner.create(browserId, this.config, this.browserPool, this.workers);
        eventsUtils.passthroughEvent(runner, this, this.getEventsToPassthrough());
        this.interceptEvents(runner, this.getEventsToIntercept());
        this.activeBrowserRunners.set(browserId, runner);
        await runner.run(testCollection);
        this.activeBrowserRunners.delete(browserId);
    }
    getEventsToPassthrough() {
        return (0, lodash_1.default)(events_1.RunnerSyncEvents).values().difference(this.getEventsToIntercept()).value();
    }
    getEventsToIntercept() {
        return (0, lodash_1.default)(this.interceptors).map("event").uniq().value();
    }
    interceptEvents(runner, events) {
        events.forEach((event) => {
            runner.on(event, data => {
                try {
                    const toEmit = this.applyInterceptors({ event, data }, this.interceptors);
                    toEmit && toEmit.event && this.emit(toEmit.event, toEmit.data);
                }
                catch (e) {
                    this.emit(events_1.MasterEvents.ERROR, e);
                }
            });
        });
    }
    applyInterceptors({ event, data } = {}, interceptors) {
        const interceptor = lodash_1.default.find(interceptors, { event });
        if (!interceptor) {
            return { event, data };
        }
        return this.applyInterceptors(interceptor.handler({ event, data }) || { event, data }, lodash_1.default.without(interceptors, interceptor));
    }
    cancel() {
        this.cancelled = true;
        this.browserPool?.cancel();
        this.activeBrowserRunners.forEach(runner => runner.cancel());
        this.workers?.cancel();
    }
    registerWorkers(workerFilepath, exportedMethods) {
        return this.workersRegistry.register(workerFilepath, exportedMethods);
    }
}
exports.MainRunner = MainRunner;
//# sourceMappingURL=index.js.map