'use strict';

const webdriverio = require('webdriverio');
const Browser = require('./browser');
const signalHandler = require('../signal-handler');
const logger = require('../utils/logger');

module.exports = class NewBrowser extends Browser {
    constructor(config, id, version) {
        super(config, id, version);

        signalHandler.on('exit', () => this.quit());
    }

    async init() {
        this._session = await this._createSession();

        this._addHistory();
        this._addCommands();

        this.restoreHttpTimeout();
        await this._setPageLoadTimeout();

        return this;
    }

    reset() {
        return Promise.resolve();
    }

    async quit() {
        try {
            this.setHttpTimeout(this._config.sessionQuitTimeout);
            await this._session.deleteSession();
        } catch (e) {
            logger.warn(`WARNING: Can not close session: ${e.message}`);
        }
    }

    _createSession() {
        const sessionOpts = this._getSessionOpts();

        return webdriverio.remote(sessionOpts);
    }

    async _setPageLoadTimeout() {
        if (!this._config.pageLoadTimeout) {
            return;
        }

        try {
            await this._session.setTimeout({pageLoad: this._config.pageLoadTimeout});
        } catch (e) {
            // edge with w3c does not support setting page load timeout
            if (this._session.isW3C && this._session.capabilities.browserName === 'MicrosoftEdge') {
                logger.warn(`WARNING: Can not set page load timeout: ${e.message}`);
            } else {
                throw e;
            }
        }
    }
};
