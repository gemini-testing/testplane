'use strict';

var inherit = require('inherit'),
    BasicPool = require('./basic-pool'),
    Browser = require('../browser');

module.exports = inherit(BasicPool, {
    __constructor: function(config) {
        this._config = config;
    },

    getBrowser: function(id) {
        return new Browser(this._config, id)
            .init();
    },

    freeBrowser: function(browser) {
        return browser.quit();
    }
});
