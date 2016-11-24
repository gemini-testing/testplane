'use strict';

const _ = require('lodash');
const q = require('q');
const URI = require('urijs');

const webdriverio = require('webdriverio');
const logger = require('./utils').logger;
const signalHandler = require('./signal-handler');

module.exports = class Browser {
    static create(config, id) {
        return new Browser(config, id);
    }

    constructor(config, id) {
        this.id = id;

        this._config = config.forBrowser(this.id);
        this._debug = config.system.debug;
        this._session = null;
        this._meta = {};

        signalHandler.on('exit', () => this.quit());
    }

    init() {
        return q(() => this._session = this._createSession().init())
            .call()
            .thenResolve(this);
    }

    quit() {
        if (!this._session) {
            return q();
        }

        // Не работает без then в виду особенностей реализации в webdriverio.js
        return this._session.then(this._session.end)
            .catch((e) => logger.warn(`WARNING: Can not close session: ${e.message}`));
    }

    get publicAPI() {
        return this._session; // exposing webdriver API as is
    }

    get sessionId() {
        return _.get(this, '_session.requestHandler.sessionID');
    }

    get meta() {
        return this._meta;
    }

    _createSession() {
        const config = this._config;
        const gridUri = new URI(config.gridUrl);
        const screenshotOnReject = config.screenshotOnReject;
        const screenshotOnRejectOpts = _.isBoolean(screenshotOnReject)
            ? screenshotOnReject
            : {connectionRetryTimeout: screenshotOnReject.httpTimeout};

        const session = webdriverio.remote({
            host: this._getGridHost(gridUri),
            port: gridUri.port(),
            path: gridUri.path(),
            desiredCapabilities: config.desiredCapabilities,
            waitforTimeout: config.waitTimeout,
            logLevel: this._debug ? 'verbose' : 'error',
            coloredLogs: true,
            screenshotPath: config.screenshotPath,
            screenshotOnReject: screenshotOnRejectOpts,
            connectionRetryTimeout: config.httpTimeout,
            connectionRetryCount: 0, // hermione has its own advanced retries
            baseUrl: config.baseUrl
        });

        this._addMetaAccessCommands(session);
        this._decorateUrlMethod(session);

        if (this._config.prepareBrowser) {
            this._config.prepareBrowser(session);
        }

        return session;
    }

    _addMetaAccessCommands(session) {
        session.addCommand('setMeta', (key, value) => this._meta[key] = value);
        session.addCommand('getMeta', (key) => this._meta[key]);
    }

    _decorateUrlMethod(session) {
        const baseUrlFn = session.url.bind(session);

        session.addCommand('url', (uri) => {
            if (uri) {
                this._meta.url = this._getMetaUrl(uri);
            }

            return baseUrlFn(uri);
        }, true); // overwrite original `url` method
    }

    _getGridHost(url) {
        return new URI({
            username: url.username(),
            password: url.password(),
            hostname: url.hostname()
        }).toString().slice(2); // URIjs leaves `//` prefix, removing it
    }

    _getMetaUrl(uri) {
        return this._config.baseUrl && uri[0] === '/'
            ? URI(this._config.baseUrl + uri).normalize().toString()
            : uri;
    }
};
