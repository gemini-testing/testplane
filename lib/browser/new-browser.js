'use strict';

const q = require('q');
const Browser = require('./browser');
const signalHandler = require('../signal-handler');
const logger = require('../utils/logger');

module.exports = class NewBrowser extends Browser {
    constructor(config, id) {
        super(config, id);

        signalHandler.on('exit', () => this.quit());
    }

    init() {
        return q(() => this._session)
            .call()
            .then(() => this.setHttpTimeout(this._config.sessionRequestTimeout))
            .then(() => this._session.init())
            .then(() => this.restoreHttpTimeout())
            .then(() => this._setPageLoadTimeout())
            .then(() => this._setDefaultWindowSize())
            .thenResolve(this);
    }

    _setPageLoadTimeout() {
        if (this._config.pageLoadTimeout) {
            return this._session.timeouts('page load', this._config.pageLoadTimeout);
        }
    }

    _setDefaultWindowSize() {
        const windowSize = this.windowSize;

        return windowSize ? this._session.windowHandleSize(windowSize) : q();
    }

    reset() {
        return this._session
            .then(() => {
                if (this.state.originWindowSize) {
                    return this._setDefaultWindowSize()
                        .then(() => this.applyState({originWindowSize: null}));
                }
            });
    }

    quit() {
        // Do not work without 'then' because of webdriverio realization of promise API
        return this._session
            .then(() => this.setHttpTimeout(this._config.sessionQuitTimeout))
            .then(() => this._session.end())
            .catch((e) => logger.warn(`WARNING: Can not close session: ${e.message}`));
    }
};
