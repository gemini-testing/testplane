'use strict';

const _ = require('lodash');
const q = require('q');
const URI = require('urijs');
const url = require('url');
const webdriverio = require('webdriverio');
const logger = require('../utils/logger');
const signalHandler = require('../signal-handler');
const commandsList = require('./commands');

module.exports = class Browser {
    static create(config, id) {
        return new Browser(config, id);
    }

    constructor(config, id) {
        this.id = id;

        this._config = config.forBrowser(this.id);
        this._debug = config.system.debug;
        this._meta = _.extend({}, this._config.meta);
        this._changes = {
            originWindowSize: null
        };

        this._session = this._createSession();
        this._addCommands();
        signalHandler.on('exit', () => this.quit());
    }

    init() {
        return q(() => this._session)
            .call()
            .then(() => this._switchOffScreenshotOnReject())
            .then(() => this._setHttpTimeout(this._config.sessionRequestTimeout))
            .then(() => this._session.init())
            .then(() => this._setDefaultWindowSize())
            .then(() => this._restoreHttpTimeout())
            .then(() => this._switchOnScreenshotOnReject())
            .thenResolve(this);
    }

    reset() {
        return this._session
            .then(() => {
                if (this.changes.originWindowSize) {
                    return this._setDefaultWindowSize()
                        .then(() => this.updateChanges({originWindowSize: null}));
                }
            });
    }

    quit() {
        // Do not work without 'then' because of webdriverio realization of promise API
        return this._session
            .then(() => this._setHttpTimeout(this._config.sessionQuitTimeout))
            .then(() => this._switchOffScreenshotOnReject())
            .then(() => this._session.end())
            .catch((e) => logger.warn(`WARNING: Can not close session: ${e.message}`));
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

    get meta() {
        return this._meta;
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

    updateChanges(changes) {
        _.extend(this._changes, changes);
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
            screenshotOnReject: this._getScreenshotOnRejectOpts(),
            connectionRetryTimeout: config.httpTimeout,
            connectionRetryCount: 0, // hermione has its own advanced retries
            baseUrl: config.baseUrl
        });
    }

    _addCommands() {
        // TODO: move commands to the "commands" dir
        this._addMetaAccessCommands(this._session);
        this._addExtendOptionsMethod(this._session);
        this._decorateUrlMethod(this._session);
        this._decorateWindowHandleSizeMethod(this._session);

        commandsList.forEach((command) => require(`./commands/${command}`)(this));
    }

    _setDefaultWindowSize() {
        const windowSize = this.windowSize;

        return windowSize ? this._session.windowHandleSize(windowSize) : q();
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

    _setHttpTimeout(timeout) {
        this._session.extendOptions({connectionRetryTimeout: timeout});
    }

    _restoreHttpTimeout() {
        this._setHttpTimeout(this._config.httpTimeout);
    }

    _switchOnScreenshotOnReject() {
        this._session.extendOptions({screenshotOnReject: this._getScreenshotOnRejectOpts()});
    }

    _switchOffScreenshotOnReject() {
        this._session.extendOptions({screenshotOnReject: false});
    }

    _getScreenshotOnRejectOpts() {
        const screenshotOnReject = this._config.screenshotOnReject;

        return _.isObject(screenshotOnReject)
            ? {connectionRetryTimeout: screenshotOnReject.httpTimeout}
            : screenshotOnReject;
    }

    _getGridHost(url) {
        return new URI({
            username: url.username(),
            password: url.password(),
            hostname: url.hostname()
        }).toString().slice(2); // URIjs leaves `//` prefix, removing it
    }

    _addMetaAccessCommands(session) {
        session.addCommand('setMeta', (key, value) => this._meta[key] = value);
        session.addCommand('getMeta', (key) => this._meta[key]);
    }

    _addExtendOptionsMethod(session) {
        session.addCommand('extendOptions', (opts) => {
            _.extend(session.requestHandler.defaultOptions, opts);
        });
    }

    _decorateUrlMethod(session) {
        const baseUrlFn = session.url.bind(session);

        session.addCommand('url', (uri) => {
            if (!uri) {
                return baseUrlFn(uri);
            }

            const newUri = this._resolveUrl(uri);
            this._meta.url = newUri;
            return baseUrlFn(newUri);
        }, true); // overwrite original `url` method
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

    _resolveUrl(uri) {
        return this._config.baseUrl ? url.resolve(this._config.baseUrl, uri) : uri;
    }
};
