"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireWithNoCache = void 0;
const requireWithNoCache = function (moduleName) {
    delete require.cache[moduleName];
    return require(moduleName);
};
exports.requireWithNoCache = requireWithNoCache;
