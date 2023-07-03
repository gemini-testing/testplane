"use strict";

const _ = require("lodash");
const { SAVE_HISTORY_MODE } = require("../constants/config");
const history = require("./history");
const addRunStepCommand = require("./commands/runStep");

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
    static create(config, id, version) {
        return new this(config, id, version);
    }

    constructor(config, id, version) {
        this.id = id;
        this.version = version;

        this._config = config.forBrowser(this.id);
        this._debug = config.system.debug;
        this._session = null;
        this._callstackHistory = null;
        this._state = {
            isBroken: false,
        };
    }

    async attach(sessionId, sessionCaps, sessionOpts) {
        this._session = await this._attachSession(sessionId, sessionCaps, sessionOpts);

        this._addSteps();
        this._addHistory();
        this._addCommands();
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
            if (!_.isNull(this._config[optName])) {
                options[optName] = this._config[optName];
            }

            return options;
        }, {});
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
};
