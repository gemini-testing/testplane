"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.build = exports.ClientBridge = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const client_bridge_1 = require("./client-bridge");
Object.defineProperty(exports, "ClientBridge", { enumerable: true, get: function () { return client_bridge_1.ClientBridge; } });
const bundlesCache = {};
const build = async (browser, opts = {}) => {
    const needsCompatLib = opts.calibration?.needsCompatLib ?? false;
    const scriptFileName = needsCompatLib ? "bundle.compat.js" : "bundle.native.js";
    if (bundlesCache[scriptFileName]) {
        return client_bridge_1.ClientBridge.create(browser, bundlesCache[scriptFileName]);
    }
    const scriptFilePath = path_1.default.join(__dirname, "..", "client-scripts", scriptFileName);
    const bundle = await fs_1.default.promises.readFile(scriptFilePath, { encoding: "utf8" });
    bundlesCache[scriptFileName] = bundle;
    return client_bridge_1.ClientBridge.create(browser, bundle);
};
exports.build = build;
//# sourceMappingURL=index.js.map