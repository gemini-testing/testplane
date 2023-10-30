"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exists = void 0;
const fs_1 = __importDefault(require("fs"));
const exists = async (path) => {
    try {
        await fs_1.default.promises.access(path);
        return true;
    }
    catch (_) {
        return false;
    }
};
exports.exists = exists;
//# sourceMappingURL=fs.js.map