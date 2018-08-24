'use strict';

const _ = require('lodash');
const q = require('q');
const URI = require('urijs');
const webdriverio = require('@gemini-testing/webdriverio');
const {keys} = require('gemini-core');

module.exports = class Browser {
    static create(config, id) {
        return new this(config, id);
    }

    constructor(config, id) {
        this.id = id;

        this._config = config.forBrowser(this.id);
        this._debug = config.system.debug;

        this._changes = {
            originWindowSize: null
        };

        this._session = this._createSession();
        this._session.keys = keys;

        this._addCommands();
    }

    setHttpTimeout(timeout) {
        if (timeout === null) {
            timeout = this._config.httpTimeout;
        }

        this._session.extendOptions({connectionRetryTimeout: timeout});
    }

    restoreHttpTimeout() {
        this.setHttpTimeout(this._config.httpTimeout);
    }

    _createSession() {
        const config = this._config;
        const gridUri = new URI(config.gridUrl);

        return webdriverio.remote({
            host: this._getGridHost(gridUri),
            port: gridUri.port(),
            path: gridUri.path(),
            desiredCapabilities: config.desiredCapabilities,
            waitforTimeout: config.waitTimeout,
            logLevel: this._debug ? 'verbose' : 'error',
            coloredLogs: true,
            screenshotPath: config.screenshotPath,
            connectionRetryTimeout: config.httpTimeout,
            connectionRetryCount: 0, // hermione has its own advanced retries
            baseUrl: config.baseUrl
        });
    }

    _getGridHost(url) {
        return new URI({
            username: url.username(),
            password: url.password(),
            hostname: url.hostname()
        }).toString().slice(2); // URIjs leaves `//` prefix, removing it
    }

    _addCommands() {
        this._addExtendOptionsMethod(this._session);
        this._decorateWindowHandleSizeMethod(this._session);
    }

    _addExtendOptionsMethod(session) {
        session.addCommand('extendOptions', (opts) => {
            _.extend(session.requestHandler.defaultOptions, opts);
        });
    }

    _decorateWindowHandleSizeMethod(session) {
        const baseWindowHandleSizeFn = session.windowHandleSize.bind(session);

        session.addCommand('windowHandleSize', (...args) => {
            // first argument can be a string with window ID
            const windowSize = typeof args[0] === 'string' ? args[1] : args[0];

            if (windowSize && !_.isEqual(this.windowSize, windowSize)) {
                return q(this._saveCurrentWindowSize())
                    .then(() => baseWindowHandleSizeFn(...args));
            }

            return baseWindowHandleSizeFn(...args);
        }, true);
    }

    _saveCurrentWindowSize() {
        if (this.windowSize) {
            return this.updateChanges({originWindowSize: this.windowSize});
        }

        return this._session
            .windowHandleSize()
            .then((windowInfo) => {
                if (windowInfo.value) {
                    const {width, height} = windowInfo.value;
                    this.updateChanges({originWindowSize: {width, height}});
                }
            });
    }

    updateChanges(changes) {
        _.extend(this._changes, changes);
    }

    get publicAPI() {
        return this._session; // exposing webdriver API as is
    }

    get sessionId() {
        return this.publicAPI.requestHandler.sessionID;
    }

    set sessionId(id) {
        this.publicAPI.requestHandler.sessionID = id;
    }

    get config() {
        return this._config;
    }

    get changes() {
        return this._changes;
    }

    get windowSize() {
        return this._config.windowSize || this.changes.originWindowSize;
    }
};
