"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.error = exports.warn = exports.log = void 0;
const strftime_1 = __importDefault(require("strftime"));
const withTimestampPrefix = (logFnName) => (...args) => {
    const timestamp = (0, strftime_1.default)("%H:%M:%S %z");
    console[logFnName](`[${timestamp}]`, ...args);
};
exports.log = withTimestampPrefix("log");
exports.warn = withTimestampPrefix("warn");
exports.error = withTimestampPrefix("error");
//# sourceMappingURL=logger.js.map