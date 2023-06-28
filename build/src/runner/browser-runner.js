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
exports.BrowserRunner = void 0;
const lodash_1 = __importDefault(require("lodash"));
const runner_1 = require("./runner");
const TestRunner = __importStar(require("./test-runner"));
const events_1 = require("../events");
const suite_monitor_1 = __importDefault(require("./suite-monitor"));
const browser_agent_1 = __importDefault(require("./browser-agent"));
const promise_group_1 = __importDefault(require("./promise-group"));
class BrowserRunner extends runner_1.Runner {
    constructor(browserId, config, browserPool, workers) {
        super();
        this._browserId = browserId;
        this.config = config;
        this.browserPool = browserPool;
        this.suiteMonitor = suite_monitor_1.default.create();
        this.passthroughEvents(this.suiteMonitor, [events_1.MasterEvents.SUITE_BEGIN, events_1.MasterEvents.SUITE_END]);
        this.activeTestRunners = new Set();
        this.workers = workers;
        this.running = new promise_group_1.default();
    }
    get browserId() {
        return this._browserId;
    }
    async run(testCollection) {
        testCollection.eachTestByVersions(this._browserId, (test) => {
            this.running.add(this._runTest(test));
        });
        await this.running.done();
    }
    addTestToRun(test) {
        if (this.running.isFulfilled()) {
            return false;
        }
        this.running.add(this._runTest(test));
        return true;
    }
    async _runTest(test) {
        const browserAgent = browser_agent_1.default.create(this._browserId, test.browserVersion, this.browserPool);
        const runner = TestRunner.create(test, this.config, browserAgent);
        runner.on(events_1.MasterEvents.TEST_BEGIN, (test) => this.suiteMonitor.testBegin(test));
        this.passthroughEvents(runner, [
            events_1.MasterEvents.TEST_BEGIN,
            events_1.MasterEvents.TEST_END,
            events_1.MasterEvents.TEST_PASS,
            events_1.MasterEvents.TEST_FAIL,
            events_1.MasterEvents.TEST_PENDING,
            events_1.MasterEvents.RETRY,
        ]);
        runner.on(events_1.MasterEvents.TEST_END, (test) => this.suiteMonitor.testEnd(test));
        runner.on(events_1.MasterEvents.RETRY, (test) => this.suiteMonitor.testRetry(test));
        this.activeTestRunners.add(runner);
        await runner.run(this.workers);
        this.activeTestRunners.delete(runner);
    }
    cancel() {
        this.activeTestRunners.forEach(runner => runner.cancel());
    }
    passthroughEvents(runner, events) {
        events.forEach(event => {
            runner.on(event, (data) => this.emit(event, lodash_1.default.extend(data, { browserId: this._browserId })));
        });
    }
}
exports.BrowserRunner = BrowserRunner;
//# sourceMappingURL=browser-runner.js.map