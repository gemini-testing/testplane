"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSafariVersion = void 0;
const lodash_1 = __importDefault(require("lodash"));
const child_process_1 = require("child_process");
exports.resolveSafariVersion = lodash_1.default.once(() => new Promise((resolve, reject) => {
    const getSafariVersionError = new Error("Couldn't retrive safari version.");
    (0, child_process_1.exec)("mdls -name kMDItemVersion /Applications/Safari.app", (err, stdout) => {
        if (err) {
            reject(getSafariVersionError);
            return;
        }
        const regExpResult = /kMDItemVersion = "(.*)"/.exec(stdout);
        if (regExpResult && regExpResult[1]) {
            resolve(regExpResult[1]);
        }
        else {
            reject(getSafariVersionError);
        }
    });
}));
//# sourceMappingURL=browser.js.map