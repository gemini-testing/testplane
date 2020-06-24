'use strict';

const q = require('q');
const Browser = require('./browser');
const signalHandler = require('../signal-handler');
const logger = require('../utils/logger');

module.exports = class NewBrowser extends Browser {
    constructor(config, id, version) {
        super(config, id, version);

        signalHandler.on('exit', () => this.quit());
    }

    init() {
        return q(() => this._session)
            .call()
            .then(() => this.setHttpTimeout(this._config.sessionRequestTimeout))
            .then(() => this._session.init())
            .then(() => this.restoreHttpTimeout())
            .then(() => this._setPageLoadTimeout())
            .thenResolve(this);
    }

    _setPageLoadTimeout() {
        if (!this._config.pageLoadTimeout) {
            return Promise.resolve();
        }

        return this._config.w3cCompatible
            ? this._session.timeouts({'pageLoad': this._config.pageLoadTimeout})
            : this._session.timeouts('page load', this._config.pageLoadTimeout);
    }

    reset() {
        return Promise.resolve();
    }

    quit() {
        // Do not work without 'then' because of webdriverio realization of promise API
        return this._session
            .then(() => this.setHttpTimeout(this._config.sessionQuitTimeout))
            .then(() => this._session.end())
            .catch((e) => logger.warn(`WARNING: Can not close session: ${e.message}`));
    }
};
