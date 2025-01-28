"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShallowStackFrames = exports.filterExtraStackFrames = exports.applyStackTraceIfBetter = exports.getFrameRelevance = exports.FRAME_RELEVANCE = exports.captureRawStackFrames = exports.getErrorTitle = void 0;
const lodash_1 = __importDefault(require("lodash"));
const error_stack_parser_1 = __importDefault(require("error-stack-parser"));
const logger_1 = __importDefault(require("../../utils/logger"));
const fs_1 = require("../../utils/fs");
const constants_1 = require("./constants");
const getErrorTitle = (e) => {
    let errorName = e.name;
    if (!errorName && e.stack) {
        const columnIndex = e.stack.indexOf(":");
        if (columnIndex !== -1) {
            errorName = e.stack.slice(0, columnIndex);
        }
        else {
            errorName = e.stack.slice(0, e.stack.indexOf("\n"));
        }
    }
    if (!errorName) {
        errorName = "Error";
    }
    return e.message ? `${errorName}: ${e.message}` : errorName;
};
exports.getErrorTitle = getErrorTitle;
const getErrorRawStackFrames = (e) => {
    const errorTitle = (0, exports.getErrorTitle)(e) + "\n";
    const errorTitleStackIndex = e.stack.indexOf(errorTitle);
    if (errorTitleStackIndex !== -1) {
        return e.stack.slice(errorTitleStackIndex + errorTitle.length);
    }
    const errorString = e.toString ? e.toString() + "\n" : "";
    const errorStringIndex = e.stack.indexOf(errorString);
    if (errorString && errorStringIndex !== -1) {
        return e.stack.slice(errorStringIndex + errorString.length);
    }
    const errorMessageStackIndex = e.stack.indexOf(e.message);
    const errorMessageEndsStackIndex = e.stack.indexOf("\n", errorMessageStackIndex + e.message.length);
    if (errorMessageStackIndex !== -1) {
        return e.stack.slice(errorMessageEndsStackIndex + 1);
    }
    const stackTraceRegExpResult = constants_1.STACK_FRAME_REG_EXP.exec(e.stack);
    return stackTraceRegExpResult ? e.stack.slice(stackTraceRegExpResult.index) : "";
};
const captureRawStackFrames = (filterFunc) => {
    const savedStackTraceLimit = Error.stackTraceLimit;
    const targetObj = {};
    Error.stackTraceLimit = constants_1.WDIO_STACK_TRACE_LIMIT;
    Error.captureStackTrace(targetObj, filterFunc || exports.captureRawStackFrames);
    Error.stackTraceLimit = savedStackTraceLimit;
    const rawFramesPosition = targetObj.stack.indexOf("\n") + 1; // crop out error message
    return targetObj.stack.slice(rawFramesPosition);
};
exports.captureRawStackFrames = captureRawStackFrames;
/**
 * @description
 * Rank values:
 *
 * 0: Can't extract code snippet; useless
 *
 * 1: WebdriverIO internals: Better than nothing
 *
 * 2: Project internals: Better than WebdriverIO internals, but worse, than user code part
 *
 * 3: User code: Best choice
 */
exports.FRAME_RELEVANCE = {
    repl: { value: 0, matcher: fileName => /^REPL\d+$/.test(fileName) },
    nodeInternals: { value: 0, matcher: fileName => /^node:[a-zA-Z\-_]/.test(fileName) },
    wdioInternals: { value: 1, matcher: fileName => fileName.includes("/node_modules/webdriverio/") },
    projectInternals: { value: 2, matcher: fileName => fileName.includes("/node_modules/") },
    userCode: { value: 3, matcher: () => true },
};
const getFrameRelevance = (frame) => {
    if ([frame.fileName, frame.lineNumber, frame.columnNumber].some(lodash_1.default.isUndefined)) {
        return 0;
    }
    const fileName = (0, fs_1.softFileURLToPath)(frame.fileName);
    for (const factor in exports.FRAME_RELEVANCE) {
        if (exports.FRAME_RELEVANCE[factor].matcher(fileName)) {
            return exports.FRAME_RELEVANCE[factor].value;
        }
    }
    return 0;
};
exports.getFrameRelevance = getFrameRelevance;
const getStackTraceRelevance = (error) => {
    const framesParsed = error_stack_parser_1.default.parse(error);
    return framesParsed.reduce((maxRelevance, frame) => {
        return Math.max(maxRelevance, (0, exports.getFrameRelevance)(frame));
    }, 0);
};
const createErrorWithStack = (stack, errorMessage = "") => {
    const newError = new Error(errorMessage);
    newError.stack = (0, exports.getErrorTitle)(newError) + "\n" + stack;
    return newError;
};
const applyStackTrace = (error, stack) => {
    if (!error || !error.message) {
        return error;
    }
    error.stack = (0, exports.getErrorTitle)(error) + "\n" + stack;
    return error;
};
const applyStackTraceIfBetter = (error, stack) => {
    if (!error || !error.message) {
        return error;
    }
    try {
        const newStackTraceRelevance = getStackTraceRelevance(createErrorWithStack(stack));
        const currentStackTraceRelevance = getStackTraceRelevance(error);
        if (newStackTraceRelevance > currentStackTraceRelevance) {
            applyStackTrace(error, stack);
        }
    }
    catch (err) {
        logger_1.default.warn("Couldn't compare error stack traces");
    }
    return error;
};
exports.applyStackTraceIfBetter = applyStackTraceIfBetter;
const filterExtraStackFrames = (error) => {
    if (!error || !error.message || !error.stack) {
        return error;
    }
    try {
        const rawFrames = getErrorRawStackFrames(error);
        const rawFramesArr = rawFrames.split("\n").filter(frame => constants_1.STACK_FRAME_REG_EXP.test(frame));
        const framesParsed = error_stack_parser_1.default.parse(error);
        if (rawFramesArr.length !== framesParsed.length) {
            return error;
        }
        // If we found something more relevant (e.g. user's code), we can remove useless testplane internal frames
        // If we haven't, we keep testplane internal frames
        const shouldDropTestplaneInternalFrames = getStackTraceRelevance(error) > exports.FRAME_RELEVANCE.projectInternals.value;
        const isIgnoredWebdriverioFrame = (frame) => {
            const isWebdriverioFrame = frame.fileName && frame.fileName.includes("/node_modules/webdriverio/");
            const fnName = frame.functionName;
            if (!isWebdriverioFrame || !fnName) {
                return false;
            }
            return constants_1.WDIO_IGNORED_STACK_FUNCTIONS.some(fn => fn === fnName || "async " + fn === fnName);
        };
        const isWdioUtilsFrame = (frame) => {
            return Boolean(frame.fileName && frame.fileName.includes("/node_modules/@wdio/utils/"));
        };
        const isTestplaneExtraInternalFrame = (frame) => {
            const testplaneExtraInternalFramePaths = [
                "/node_modules/testplane/src/browser/history/",
                "/node_modules/testplane/src/browser/stacktrace/",
            ];
            return Boolean(frame.fileName && testplaneExtraInternalFramePaths.some(path => frame.fileName?.includes(path)));
        };
        const shouldIncludeFrame = (frame) => {
            if (isIgnoredWebdriverioFrame(frame) || isWdioUtilsFrame(frame)) {
                return false;
            }
            if (shouldDropTestplaneInternalFrames && isTestplaneExtraInternalFrame(frame)) {
                return false;
            }
            return true;
        };
        const framesFiltered = rawFramesArr.filter((_, i) => shouldIncludeFrame(framesParsed[i])).join("\n");
        return applyStackTrace(error, framesFiltered);
    }
    catch (filterError) {
        logger_1.default.warn("Couldn't filter out wdio frames", filterError);
        return error;
    }
};
exports.filterExtraStackFrames = filterExtraStackFrames;
class ShallowStackFrames {
    constructor() {
        this._framesMap = new Map();
        this._key = 1;
    }
    getKey() {
        return String(this._key++);
    }
    enter(key, frames) {
        this._framesMap.set(key, frames);
    }
    leave(key) {
        this._framesMap.delete(key);
    }
    _getParentStackFrame(childFrames) {
        for (const parentFrames of this._framesMap.values()) {
            if (childFrames.length !== parentFrames.length && childFrames.endsWith(parentFrames)) {
                return parentFrames;
            }
        }
        return null;
    }
    areInternal(childFrames) {
        const parentStackFrame = this._getParentStackFrame(childFrames);
        if (!parentStackFrame) {
            return false;
        }
        const isNodeModulesFrame = (frame) => frame.includes("/node_modules/");
        const isNodeInternalFrame = (frame) => frame.includes(" (node:");
        const extraFrames = childFrames.slice(0, childFrames.length - parentStackFrame.length);
        const extraFramesArray = extraFrames.split("\n");
        return extraFramesArray.every(frame => !frame || isNodeModulesFrame(frame) || isNodeInternalFrame(frame));
    }
}
exports.ShallowStackFrames = ShallowStackFrames;
//# sourceMappingURL=utils.js.map