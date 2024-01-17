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
exports.Hermione = void 0;
const _ = __importStar(require("lodash"));
const stats_1 = require("./stats");
const base_hermione_1 = require("./base-hermione");
const runner_1 = require("./runner");
const runtime_config_1 = __importDefault(require("./config/runtime-config"));
const events_1 = require("./events");
const utils_1 = __importDefault(require("./events/utils"));
const signal_handler_1 = __importDefault(require("./signal-handler"));
const test_reader_1 = __importDefault(require("./test-reader"));
const test_collection_1 = require("./test-collection");
const validators_1 = require("./validators");
const reporters_1 = require("./reporters");
const logger_1 = __importDefault(require("./utils/logger"));
class Hermione extends base_hermione_1.BaseHermione {
    constructor(config) {
        super(config);
        this.failed = false;
        this.runner = null;
    }
    extendCli(parser) {
        this.emit(events_1.MasterEvents.CLI, parser);
    }
    async run(testPaths, { browsers, sets, grep, updateRefs, requireModules, inspectMode, replMode, devtools, reporters = [], } = {}) {
        (0, validators_1.validateUnknownBrowsers)(browsers, _.keys(this._config.browsers));
        runtime_config_1.default.getInstance().extend({ updateRefs, requireModules, inspectMode, replMode, devtools });
        if (replMode?.enabled) {
            this._config.system.mochaOpts.timeout = 0;
        }
        const runner = runner_1.MainRunner.create(this._config, this._interceptors);
        this.runner = runner;
        this.on(events_1.MasterEvents.TEST_FAIL, () => this._fail()).on(events_1.MasterEvents.ERROR, (err) => this.halt(err));
        await (0, reporters_1.initReporters)(reporters, this);
        utils_1.default.passthroughEvent(this.runner, this, _.values(events_1.MasterSyncEvents));
        utils_1.default.passthroughEventAsync(this.runner, this, _.values(events_1.MasterAsyncEvents));
        utils_1.default.passthroughEventAsync(signal_handler_1.default, this, events_1.MasterEvents.EXIT);
        await this._init();
        runner.init();
        await runner.run(await this._readTests(testPaths, { browsers, sets, grep, replMode }), stats_1.Stats.create(this));
        return !this.isFailed();
    }
    async _readTests(testPaths, opts) {
        return testPaths instanceof test_collection_1.TestCollection ? testPaths : await this.readTests(testPaths, opts);
    }
    addTestToRun(test, browserId) {
        return this.runner ? this.runner.addTestToRun(test, browserId) : false;
    }
    async readTests(testPaths, { browsers, sets, grep, silent, ignore, replMode } = {}) {
        const testReader = test_reader_1.default.create(this._config);
        if (!silent) {
            await this._init();
            utils_1.default.passthroughEvent(testReader, this, [
                events_1.MasterEvents.BEFORE_FILE_READ,
                events_1.MasterEvents.AFTER_FILE_READ,
            ]);
        }
        const specs = await testReader.read({ paths: testPaths, browsers, ignore, sets, grep, replMode });
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
exports.Hermione = Hermione;
//# sourceMappingURL=hermione.js.map