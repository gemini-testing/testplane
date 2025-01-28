"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserEventNames = void 0;
const constants_1 = require("./constants");
// TODO: use from "./browser-modules/types" after migrate to esm
var BrowserEventNames;
(function (BrowserEventNames) {
    BrowserEventNames["initialize"] = "browser:initialize";
    BrowserEventNames["runBrowserCommand"] = "browser:runBrowserCommand";
    BrowserEventNames["runExpectMatcher"] = "browser:runExpectMatcher";
    BrowserEventNames["callConsoleMethod"] = "browser:callConsoleMethod";
    BrowserEventNames["reconnect"] = "browser:reconnect";
})(BrowserEventNames || (exports.BrowserEventNames = BrowserEventNames = {}));
//# sourceMappingURL=types.js.map