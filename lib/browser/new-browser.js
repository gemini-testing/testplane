'use strict';

const Browser = require('./browser');
const signalHandler = require('../signal-handler');
const logger = require('../utils/logger');

module.exports = class NewBrowser extends Browser {
    constructor(config, id, version) {
        super(config, id, version);

        signalHandler.on('exit', () => this.quit());
    }

    async init() {
        await super.init();

        this.restoreHttpTimeout();
        await this._setPageLoadTimeout();

        return this;
    }

    async _setPageLoadTimeout() {
        if (!this._config.pageLoadTimeout) {
            return;
        }

        try {
            await this._session.setTimeout({'pageLoad': this._config.pageLoadTimeout});
        } catch (e) {
            // TODO: fix after - https://github.com/webdriverio/webdriverio/issues/6575
            logger.warn(`WARNING: Can not set page load timeout: ${e.message}`);
        }
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
};
