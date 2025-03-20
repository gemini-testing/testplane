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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLocationWithStackFrame = exports.findRelevantStackFrame = void 0;
const error_stack_parser_1 = __importDefault(require("error-stack-parser"));
const logger = __importStar(require("../utils/logger"));
const utils_1 = require("../browser/stacktrace/utils");
const fs_1 = require("../utils/fs");
const findRelevantStackFrame = (error) => {
    try {
        const parsedStackFrames = error_stack_parser_1.default.parse(error);
        let relevantFrame = null;
        let relevantFrameRank = 0;
        for (const currentFrame of parsedStackFrames) {
            const currentFrameRank = (0, utils_1.getFrameRelevance)(currentFrame);
            if (currentFrameRank > relevantFrameRank) {
                relevantFrame = currentFrame;
                relevantFrameRank = currentFrameRank;
            }
        }
        return relevantFrame;
    }
    catch (findError) {
        logger.warn("Unable to find relevant stack frame:", findError);
        return null;
    }
};
exports.findRelevantStackFrame = findRelevantStackFrame;
const resolveLocationWithStackFrame = (stackFrame, fileContents) => ({
    file: (0, fs_1.softFileURLToPath)(stackFrame.fileName),
    source: fileContents,
    location: { line: stackFrame.lineNumber, column: stackFrame.columnNumber },
});
exports.resolveLocationWithStackFrame = resolveLocationWithStackFrame;
//# sourceMappingURL=frames.js.map