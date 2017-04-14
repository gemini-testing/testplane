'use strict';

var inherit = require('inherit');

var Matcher = inherit({
    __constructor: function(test, browser) {
        this.browser = browser;
        this.file = test.file;
        this._fullTitle = test.fullTitle();
    },

    test: function(test, browser) {
        return browser === this.browser
            && test.file === this.file
            && test.fullTitle() === this._fullTitle;
    }
}, {
    create: function(test, browser) {
        return new Matcher(test, browser);
    }
});

module.exports = Matcher;
