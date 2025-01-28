"use strict";
const path = require("path");
const fs = require("fs");
const ClientBridge = require("./client-bridge");
const bundlesCache = {};
exports.ClientBridge = ClientBridge;
exports.build = async (browser, opts = {}) => {
    const needsCompatLib = opts.calibration && opts.calibration.needsCompatLib;
    const scriptFileName = needsCompatLib ? "bundle.compat.js" : "bundle.native.js";
    if (bundlesCache[scriptFileName]) {
        return ClientBridge.create(browser, bundlesCache[scriptFileName]);
    }
    const scriptFilePath = path.join(__dirname, "..", "client-scripts", scriptFileName);
    const bundle = await fs.promises.readFile(scriptFilePath, { encoding: "utf8" });
    bundlesCache[scriptFileName] = bundle;
    return ClientBridge.create(browser, bundle);
};
//# sourceMappingURL=index.js.map