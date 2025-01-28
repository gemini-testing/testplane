"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Key = exports.default = void 0;
// Declares global hooks
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../typings/global.d.ts" />
// Augments browser and element methods
require("./browser/types");
// Declares global expect function
require("expect-webdriverio");
var testplane_1 = require("./testplane");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return testplane_1.Testplane; } });
var webdriverio_1 = require("@testplane/webdriverio");
Object.defineProperty(exports, "Key", { enumerable: true, get: function () { return webdriverio_1.Key; } });
__exportStar(require("./mock"), exports);
//# sourceMappingURL=index.js.map