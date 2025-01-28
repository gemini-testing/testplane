"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRunInNodeJsEnv = void 0;
const config_1 = require("../constants/config");
const isRunInNodeJsEnv = (config) => {
    return config.system.testRunEnv === config_1.NODEJS_TEST_RUN_ENV;
};
exports.isRunInNodeJsEnv = isRunInNodeJsEnv;
//# sourceMappingURL=config.js.map