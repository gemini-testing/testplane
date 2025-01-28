"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const addRunStepCommand = (browser) => {
    const { publicAPI: session } = browser;
    session.addCommand("runStep", (stepName, stepCb) => {
        if (!lodash_1.default.isString(stepName)) {
            throw Error(`First argument must be a string, but got ${typeof stepName}`);
        }
        if (!lodash_1.default.isFunction(stepCb)) {
            throw Error(`Second argument must be a function, but got ${typeof stepCb}`);
        }
        return stepCb();
    });
};
exports.default = addRunStepCommand;
//# sourceMappingURL=runStep.js.map