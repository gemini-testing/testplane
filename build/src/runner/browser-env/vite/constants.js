"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AUTOMOCK_DIRECTORY = exports.DEFAULT_AUTOMOCK = exports.MOCK_MODULE_NAME = exports.WORKER_ENV_BY_RUN_UUID = exports.SOCKET_TIMED_OUT_ERROR = exports.SOCKET_MAX_TIMEOUT = exports.BROWSER_EVENT_PREFIX = exports.VITE_RUN_UUID_ROUTE = exports.VITE_DEFAULT_CONFIG_ENV = exports.MODULE_NAMES = exports.MODULE_PREFIX = void 0;
exports.MODULE_PREFIX = "@testplane";
exports.MODULE_NAMES = {
    mocha: `${exports.MODULE_PREFIX}/mocha`,
    browserRunner: `${exports.MODULE_PREFIX}/browser-runner`,
    globals: `${exports.MODULE_PREFIX}/globals`,
};
exports.VITE_DEFAULT_CONFIG_ENV = {
    command: "serve",
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
};
exports.VITE_RUN_UUID_ROUTE = "run-uuids";
exports.BROWSER_EVENT_PREFIX = "browser";
exports.SOCKET_MAX_TIMEOUT = 2147483647;
exports.SOCKET_TIMED_OUT_ERROR = "operation has timed out";
exports.WORKER_ENV_BY_RUN_UUID = new Map();
exports.MOCK_MODULE_NAME = "testplane";
exports.DEFAULT_AUTOMOCK = false;
exports.DEFAULT_AUTOMOCK_DIRECTORY = "__mocks__";
//# sourceMappingURL=constants.js.map