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
exports.Browser = void 0;
const crypto_1 = __importDefault(require("crypto"));
const lodash_1 = __importDefault(require("lodash"));
const config_1 = require("../constants/config");
const browser_1 = require("../constants/browser");
const history = __importStar(require("./history"));
const stacktrace_1 = require("./stacktrace");
const commands_1 = require("./history/commands");
const runStep_1 = __importDefault(require("./commands/runStep"));
const CUSTOM_SESSION_OPTS = [
    "outputDir",
    "agent",
    "headers",
    "transformRequest",
    "transformResponse",
    "strictSSL",
    // cloud service opts
    "user",
    "key",
    "region",
];
class Browser {
    static create(config, opts) {
        return new this(config, opts);
    }
    constructor(config, opts) {
        this.id = opts.id;
        this.version = opts.version;
        this._config = config.forBrowser(this.id);
        this._debug = config.system.debug;
        this._session = null;
        this._callstackHistory = null;
        this._wdProcess = null;
        this._state = {
            ...opts.state,
            isBroken: false,
        };
        this._customCommands = new Set();
        this._wdPool = opts.wdPool;
        this._emitter = opts.emitter;
    }
    setHttpTimeout(timeout) {
        if (timeout === null) {
            timeout = this._config.httpTimeout;
        }
        this._session.extendOptions({ connectionRetryTimeout: timeout });
    }
    restoreHttpTimeout() {
        this.setHttpTimeout(this._config.httpTimeout);
    }
    applyState(state) {
        lodash_1.default.extend(this._state, state);
    }
    _addCommands() {
        this._addExtendOptionsMethod(this._session);
    }
    _addSteps() {
        (0, runStep_1.default)(this);
    }
    _extendStacktrace() {
        (0, stacktrace_1.enhanceStacktraces)(this._session);
    }
    _addHistory() {
        if (this._config.saveHistoryMode !== config_1.SAVE_HISTORY_MODE.NONE) {
            this._callstackHistory = history.initCommandHistory(this._session);
        }
    }
    _addExtendOptionsMethod(session) {
        session.addCommand("extendOptions", opts => {
            lodash_1.default.extend(session.options, opts);
        });
    }
    _getSessionOptsFromConfig(optNames = CUSTOM_SESSION_OPTS) {
        return optNames.reduce((options, optName) => {
            if (optName === "transformRequest") {
                options[optName] = (req) => {
                    if (!lodash_1.default.isNull(this._config[optName])) {
                        req = this._config[optName](req);
                    }
                    if (!req.headers["X-Request-ID"]) {
                        req.headers["X-Request-ID"] = `${this.state.testXReqId}${browser_1.X_REQUEST_ID_DELIMITER}${crypto_1.default.randomUUID()}`;
                    }
                    if (!req.headers["traceparent"] && this.state.traceparent) {
                        req.headers["traceparent"] = this.state.traceparent;
                    }
                    return req;
                };
            }
            else if (!lodash_1.default.isNull(this._config[optName])) {
                options[optName] = this._config[optName];
            }
            return options;
        }, {});
    }
    _startCollectingCustomCommands() {
        const browserCommands = (0, commands_1.getBrowserCommands)();
        const elementCommands = (0, commands_1.getElementCommands)();
        this._session.overwriteCommand("addCommand", (origCommand, name, wrapper, elementScope, ...rest) => {
            const isKnownCommand = elementScope ? elementCommands.includes(name) : browserCommands.includes(name);
            if (!isKnownCommand) {
                this._customCommands.add({ name, elementScope: Boolean(elementScope) });
            }
            return origCommand(name, wrapper, elementScope, ...rest);
        });
    }
    get fullId() {
        return this.version ? `${this.id}.${this.version}` : this.id;
    }
    get publicAPI() {
        return this._session; // exposing webdriver API as is
    }
    get sessionId() {
        return this.publicAPI.sessionId;
    }
    get config() {
        return this._config;
    }
    get state() {
        return this._state;
    }
    get capabilities() {
        return this.publicAPI.capabilities;
    }
    get callstackHistory() {
        return this._callstackHistory;
    }
    get customCommands() {
        const allCustomCommands = Array.from(this._customCommands);
        return lodash_1.default.uniqWith(allCustomCommands, lodash_1.default.isEqual);
    }
    get emitter() {
        return this._emitter;
    }
}
exports.Browser = Browser;
//# sourceMappingURL=browser.js.map