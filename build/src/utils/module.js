"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireModuleSync = exports.requireModule = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = require("./fs");
const requireModule = async (modulePath) => {
    const isModuleLocal = await (0, fs_1.exists)(modulePath);
    return require(isModuleLocal ? path_1.default.resolve(modulePath) : modulePath);
};
exports.requireModule = requireModule;
const requireModuleSync = (modulePath) => {
    return require(modulePath);
};
exports.requireModuleSync = requireModuleSync;
//# sourceMappingURL=module.js.map