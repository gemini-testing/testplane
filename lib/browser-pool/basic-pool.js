'use strict';

var inherit = require('inherit'),
    Pool = require('./pool'),
    Browser = require('../browser'),
    q = require('q');

module.exports = inherit(Pool, {
    __constructor: function(config) {
        this._config = config;
    },

    getBrowser: function(id) {
        return new Browser(this._config, id)
            .init();
    },

    freeBrowser: function(browser) {
        return browser.quit();
    },

    terminate: function() {
        this.getBrowser = function() {
            return q.reject('Sessions are being terminating');
        };
    }
});
