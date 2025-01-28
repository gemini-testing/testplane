"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.softFileURLToPath = exports.exists = void 0;
const fs_1 = __importDefault(require("fs"));
const url_1 = require("url");
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
const softFileURLToPath = (fileName) => {
    if (!fileName.startsWith("file://")) {
        return fileName;
    }
    try {
        return (0, url_1.fileURLToPath)(fileName);
    }
    catch (_) {
        return fileName;
    }
};
exports.softFileURLToPath = softFileURLToPath;
//# sourceMappingURL=fs.js.map