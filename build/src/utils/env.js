"use strict";
// if `name` is defined as array, value for first defined in the array env name will be returned
exports.parseCommaSeparatedValue = name => {
    const names = [].concat(name);
    const usedEnvName = names.find(name => process.env[name]) || names[0];
    const envValue = process.env[usedEnvName];
    const resultValue = envValue ? envValue.split(/, */) : [];
    return { value: resultValue, key: usedEnvName };
};
//# sourceMappingURL=env.js.map