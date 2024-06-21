"use strict";

const crypto = require("crypto");
const _ = require("lodash");
const { SAVE_HISTORY_MODE } = require("../constants/config");
const { X_REQUEST_ID_DELIMITER } = require("../constants/browser");
const history = require("./history");
const stacktrace = require("./stacktrace");
const { getBrowserCommands, getElementCommands } = require("./history/commands");
const addRunStepCommand = require("./commands/runStep").default;

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

module.exports = class Browser {
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
        this._state = {
            ...opts.state,
            isBroken: false,
        };
        this._customCommands = new Set();
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
        _.extend(this._state, state);
    }

    _addCommands() {
        this._addExtendOptionsMethod(this._session);
    }

    _addSteps() {
        addRunStepCommand(this);
    }

    _extendStacktrace() {
        stacktrace.enhanceStacktraces(this._session);
    }

    _addHistory() {
        if (this._config.saveHistoryMode !== SAVE_HISTORY_MODE.NONE) {
            this._callstackHistory = history.initCommandHistory(this._session);
        }
    }

    _addExtendOptionsMethod(session) {
        session.addCommand("extendOptions", opts => {
            _.extend(session.options, opts);
        });
    }

    _getSessionOptsFromConfig(optNames = CUSTOM_SESSION_OPTS) {
        return optNames.reduce((options, optName) => {
            if (optName === "transformRequest") {
                options[optName] = req => {
                    if (!_.isNull(this._config[optName])) {
                        req = this._config[optName](req);
                    }

                    if (!req.headers["X-Request-ID"]) {
                        req.headers["X-Request-ID"] = `${
                            this.state.testXReqId
                        }${X_REQUEST_ID_DELIMITER}${crypto.randomUUID()}`;
                    }
                    if (!req.headers["traceparent"] && this.state.traceparent) {
                        req.headers["traceparent"] = this.state.traceparent;
                    }

                    return req;
                };
            } else if (!_.isNull(this._config[optName])) {
                options[optName] = this._config[optName];
            }

            return options;
        }, {});
    }

    _startCollectingCustomCommands() {
        const browserCommands = getBrowserCommands();
        const elementCommands = getElementCommands();

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
        return _.uniqWith(allCustomCommands, _.isEqual);
    }
};
