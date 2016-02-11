'use strict';

var q = require('q'),
    inherit = require('inherit'),
    URI = require('urijs'),
    webdriverio = require('webdriverio'),
    logger = require('./utils').logger,
    signalHandler = require('./signalHandler');

module.exports = inherit({
    __constructor: function(config, id) {
        this.id = id;
        this._config = config;
        this._session = null;

        signalHandler.on('exit', function() {
            return this.quit();
        }.bind(this));
    },

    init: function() {
        this._session = this._createSession().init();
        return q.when(this._session)
            .thenResolve(this);
    },

    quit: function() {
        if (!this._session) {
            return q();
        }

        // Не работает без then в виду особенностей реализации в webdriverio.js
        return this._session.then(this._session.end)
            .catch(function(e) {
                logger.warn('WARNING: Can not close session: ' + e.message);
            });
    },

    get publicAPI() {
        return this._session; // exposing webdriver API as is
    },

    get sessionId() {
        return this._session
            && this._session.requestHandler
            && this._session.requestHandler.sessionID;
    },

    _createSession: function() {
        var config = this._config,
            gridUri = new URI(config.grid),
            session = webdriverio.remote({
                host: this._getGridHost(gridUri),
                port: gridUri.port(),
                path: gridUri.path(),
                desiredCapabilities: config.browsers[this.id].desiredCapabilities,
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
