'use strict';

var q = require('q'),
    inherit = require('inherit'),
    URI = require('urijs'),
    webdriverio = require('webdriverio'),
    logger = require('./utils').logger;

module.exports = inherit({
    __constructor: function(config, id) {
        this.id = id;
        this._config = config;
        this._session = null;
    },

    init: function() {
        this._session = this._createSession();

        return q.when(this._session.init())
            .thenResolve(this);
    },

    quit: function() {
        return q.when(this._session.end())
            .fail(function(e) {
                logger.warn('WARNING: Can not close session: ' + e.message);
            });
    },

    get publicAPI() {
        return this._session; // exposing webdriver API as is
    },

    get sessionId() {
        return this._session &&
               this._session.requestHandler &&
               this._session.requestHandler.sessionID;
    },

    _createSession: function() {
        var config = this._config,
            gridUri = new URI(config.grid),
            session = webdriverio.remote({
                host: this._getGridHost(gridUri),
                port: gridUri.port(),
                path: gridUri.path(),
                desiredCapabilities: config.browsers[this.id].capabilities,
                waitforTimeout: config.waitTimeout,
                logLevel: config.debug ? 'verbose' : 'error',
                coloredLogs: true,
                screenshotPath: config.screenshotPath,
                baseUrl: config.baseUrl
            });

        if (this._config.prepareBrowser) {
            this._config.prepareBrowser(session);
        }

        return session;
    },

    _getGridHost: function(url) {
        return new URI({
            username: url.username(),
            password: url.password(),
            hostname: url.hostname()
        }).toString().slice(2); // URIjs leaves `//` prefix, removing it
    }
});
