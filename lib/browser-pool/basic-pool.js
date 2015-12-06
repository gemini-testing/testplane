'use strict';

var q = require('q'),
    inherit = require('inherit');

module.exports = inherit({
    getBrowser: function(id) {
        return q.resolve();
    },

    freeBrowser: function(browser) {
        return q.resolve();
    }
});
