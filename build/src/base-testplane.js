"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTestplane = void 0;
const lodash_1 = __importDefault(require("lodash"));
const plugins_loader_1 = __importDefault(require("plugins-loader"));
const config_1 = require("./config");
const events_1 = require("./events");
const errors_1 = __importDefault(require("./errors"));
const typescript_1 = require("./utils/typescript");
class BaseTestplane extends events_1.AsyncEmitter {
    static create(config) {
        return new this(config);
    }
    constructor(config) {
        super();
        this._interceptors = [];
        this._interceptors = [];
        (0, typescript_1.tryToRegisterTsNode)(this.isWorker());
        this._config = config_1.Config.create(config);
        this._setLogLevel();
        this._loadPlugins();
    }
    async _init() {
        this._init = () => Promise.resolve(); // init only once
        await this.emitAndWait(events_1.MasterEvents.INIT);
    }
    get config() {
        return this._config;
    }
    get events() {
        return lodash_1.default.extend({}, events_1.MasterEvents, events_1.WorkerEvents);
    }
    get errors() {
        return errors_1.default;
    }
    intercept(event, handler) {
        this._interceptors.push({ event, handler });
        return this;
    }
    _setLogLevel() {
        if (!process.env.WDIO_LOG_LEVEL) {
            process.env.WDIO_LOG_LEVEL = lodash_1.default.get(this.config, "system.debug", false) ? "trace" : "error";
        }
    }
    _loadPlugins() {
        plugins_loader_1.default.load(this, this.config.plugins, "hermione-");
    }
}
exports.BaseTestplane = BaseTestplane;
//# sourceMappingURL=base-testplane.js.map