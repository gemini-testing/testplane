'use strict';

var lib = require('./lib');

module.exports = function queryIgnoreAreas(selector) {
    return typeof selector === 'string'
        ? [lib.queryFirst(selector)]
        : lib.queryAll(selector.every);
};
