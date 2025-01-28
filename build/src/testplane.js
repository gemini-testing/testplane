"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Testplane = void 0;
const lodash_1 = __importDefault(require("lodash"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const stats_1 = require("./stats");
const base_testplane_1 = require("./base-testplane");
const runner_1 = require("./runner");
const browser_env_1 = require("./runner/browser-env");
const runtime_config_1 = __importDefault(require("./config/runtime-config"));
const events_1 = require("./events");
const utils_1 = __importDefault(require("./events/utils"));
const signal_handler_1 = __importDefault(require("./signal-handler"));
const test_reader_1 = require("./test-reader");
const test_collection_1 = require("./test-collection");
const validators_1 = require("./validators");
const reporters_1 = require("./reporters");
const logger_1 = __importDefault(require("./utils/logger"));
const config_1 = require("./utils/config");
const dev_server_1 = require("./dev-server");
class Testplane extends base_testplane_1.BaseTestplane {
    constructor(config) {
        super(config);
        this.failed = false;
        this.failedList = [];
        this.runner = null;
    }
    extendCli(parser) {
        this.emit(events_1.MasterEvents.CLI, parser);
    }
    async _init() {
        await (0, dev_server_1.initDevServer)({
            testplane: this,
            devServerConfig: this._config.devServer,
            configPath: this._config.configPath,
        });
        return super._init();
    }
    async run(testPaths, { browsers, sets, grep, updateRefs, requireModules, inspectMode, replMode, devtools, local, reporters = [], } = {}) {
        (0, validators_1.validateUnknownBrowsers)(browsers, lodash_1.default.keys(this._config.browsers));
        runtime_config_1.default.getInstance().extend({ updateRefs, requireModules, inspectMode, replMode, devtools, local });
        if (replMode?.enabled) {
            this._config.system.mochaOpts.timeout = 0;
        }
        const runner = ((0, config_1.isRunInNodeJsEnv)(this._config) ? runner_1.MainRunner : browser_env_1.MainRunner).create(this._config, this._interceptors);
        this.runner = runner;
        this.on(events_1.MasterEvents.TEST_FAIL, res => {
            this._fail();
            this._addFailedTest(res);
        });
        this.on(events_1.MasterEvents.ERROR, (err) => this.halt(err));
        this.on(events_1.MasterEvents.RUNNER_END, async () => await this._saveFailed());
        await (0, reporters_1.initReporters)(reporters, this);
        utils_1.default.passthroughEvent(this.runner, this, lodash_1.default.values(events_1.MasterSyncEvents));
        utils_1.default.passthroughEventAsync(this.runner, this, lodash_1.default.values(events_1.MasterAsyncEvents));
        utils_1.default.passthroughEventAsync(signal_handler_1.default, this, events_1.MasterEvents.EXIT);
        await this._init();
        runner.init();
        await runner.run(await this._readTests(testPaths, { browsers, sets, grep, replMode }), stats_1.Stats.create(this));
        return !this.isFailed();
    }
    async _saveFailed() {
        await fs_extra_1.default.outputJSON(this._config.lastFailed.output, this.failedList); // No spaces because users usually don't need to read it
    }
    async _readTests(testPaths, opts) {
        return testPaths instanceof test_collection_1.TestCollection ? testPaths : await this.readTests(testPaths, opts);
    }
    addTestToRun(test, browserId) {
        return this.runner ? this.runner.addTestToRun(test, browserId) : false;
    }
    async readTests(testPaths, { browsers, sets, grep, silent, ignore, replMode, runnableOpts } = {}) {
        const testReader = test_reader_1.TestReader.create(this._config);
        if (!silent) {
            await this._init();
            utils_1.default.passthroughEvent(testReader, this, [
                events_1.MasterEvents.BEFORE_FILE_READ,
                events_1.MasterEvents.AFTER_FILE_READ,
            ]);
        }
        const specs = await testReader.read({ paths: testPaths, browsers, ignore, sets, grep, replMode, runnableOpts });
        const collection = test_collection_1.TestCollection.create(specs);
        collection.getBrowsers().forEach(bro => {
            if (this._config.forBrowser(bro).strictTestsOrder) {
                collection.sortTests(bro, ({ id: a }, { id: b }) => (a < b ? -1 : 1));
            }
        });
        if (!silent) {
            this.emit(events_1.MasterEvents.AFTER_TESTS_READ, collection);
        }
        return collection;
    }
    isFailed() {
        return this.failed;
    }
    _fail() {
        this.failed = true;
    }
    _addFailedTest(result) {
        this.failedList.push({
            fullTitle: result.fullTitle(),
            browserId: result.browserId,
            browserVersion: result.browserVersion,
        });
    }
    isWorker() {
        return false;
    }
    halt(err, timeout = 60000) {
        logger_1.default.error("Terminating on critical error:", err);
        this._fail();
        if (timeout > 0) {
            setTimeout(() => {
                logger_1.default.error("Forcing shutdown...");
                process.exit(1);
            }, timeout).unref();
        }
        if (this.runner) {
            this.runner.cancel();
        }
    }
}
exports.Testplane = Testplane;
//# sourceMappingURL=testplane.js.map