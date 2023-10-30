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
exports.BaseHermione = void 0;
const lodash_1 = __importDefault(require("lodash"));
const plugins_loader_1 = __importDefault(require("plugins-loader"));
const config_1 = require("./config");
const events_1 = require("./events");
const errors_1 = __importDefault(require("./errors"));
const typescript_1 = require("./utils/typescript");
const packageJson = __importStar(require("../package.json"));
const PREFIX = packageJson.name + "-";
class BaseHermione extends events_1.AsyncEmitter {
    static create(config) {
        return new this(config);
    }
    constructor(config) {
        super();
        this._interceptors = [];
        this._interceptors = [];
        (0, typescript_1.tryToRegisterTsNode)();
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
        plugins_loader_1.default.load(this, this.config.plugins, PREFIX);
    }
}
exports.BaseHermione = BaseHermione;
//# sourceMappingURL=base-hermione.js.map