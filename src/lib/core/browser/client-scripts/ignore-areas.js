'use strict';

var lib = require('./lib');

module.exports = function queryIgnoreAreas(selector) {
    return lib.queryAll(selector);
};
