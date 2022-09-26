"use strict";
exports.__esModule = true;
var lib = require('./lib');
function queryIgnoreAreas(selector) {
    if (typeof selector === 'string') {
        var node = lib.queryFirst(selector);
        return node ? [node] : [];
    }
    return lib.queryAll(selector.every);
}
exports["default"] = queryIgnoreAreas;
