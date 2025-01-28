"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLocationWithStackFrame = exports.findRelevantStackFrame = void 0;
const error_stack_parser_1 = __importDefault(require("error-stack-parser"));
const logger_1 = __importDefault(require("../utils/logger"));
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
        logger_1.default.warn("Unable to find relevant stack frame:", findError);
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