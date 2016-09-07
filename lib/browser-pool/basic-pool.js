'use strict';

const q = require('q');

const Pool = require('./pool');
const Browser = require('../browser');

module.exports = class BasicPool extends Pool {
    constructor(config) {
        super();

        this._config = config;
    }

    getBrowser(id) {
        return Browser.create(this._config, id).init();
    }

    freeBrowser(browser) {
        return browser.quit();
    }

    terminate() {
        this.getBrowser = () => q.reject('Sessions are being terminating');
    }
};
