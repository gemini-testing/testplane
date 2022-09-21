export const requireWithNoCache = function(moduleName: string): NodeRequire {
    delete require.cache[moduleName];

    return require(moduleName);
};
