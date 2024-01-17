"use strict";
exports.parseCommaSeparatedValue = name => {
    const value = process.env[name];
    return value ? value.split(/, */) : [];
};
//# sourceMappingURL=env.js.map