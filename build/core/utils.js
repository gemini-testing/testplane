'use strict';
exports.requireWithNoCache = function (moduleName) {
    delete require.cache[moduleName];
    return require(moduleName);
};
