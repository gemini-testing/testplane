import _ from "lodash";
import ErrorStackParser from "error-stack-parser";
import type { SetRequired } from "type-fest";
import * as logger from "../../utils/logger";
import { softFileURLToPath } from "../../utils/fs";
import { STACK_FRAME_REG_EXP, WDIO_IGNORED_STACK_FUNCTIONS, WDIO_STACK_TRACE_LIMIT } from "./constants";

export type RawStackFrames = string;

type ErrorWithStack = SetRequired<Error, "stack">;

export const getErrorTitle = (e: Error): string => {
    let errorName = e.name;

    if (!errorName && e.stack) {
        const columnIndex = e.stack.indexOf(":");

        if (columnIndex !== -1) {
            errorName = e.stack.slice(0, columnIndex);
        } else {
            errorName = e.stack.slice(0, e.stack.indexOf("\n"));
        }
    }

    if (!errorName) {
        errorName = "Error";
    }

    return e.message ? `${errorName}: ${e.message}` : errorName;
};

const getErrorRawStackFrames = (e: ErrorWithStack): RawStackFrames => {
    const errorTitle = getErrorTitle(e) + "\n";
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

    const stackTraceRegExpResult = STACK_FRAME_REG_EXP.exec(e.stack);

    return stackTraceRegExpResult ? e.stack.slice(stackTraceRegExpResult.index) : "";
};

export const captureRawStackFrames = (filterFunc?: (...args: unknown[]) => unknown): RawStackFrames => {
    const savedStackTraceLimit = Error.stackTraceLimit;
    const targetObj = {} as { stack: RawStackFrames };

    Error.stackTraceLimit = WDIO_STACK_TRACE_LIMIT;
    Error.captureStackTrace(targetObj, filterFunc || captureRawStackFrames);
    Error.stackTraceLimit = savedStackTraceLimit;

    const rawFramesPosition = targetObj.stack.indexOf("\n") + 1; // crop out error message

    return targetObj.stack.slice(rawFramesPosition);
};

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
export const FRAME_RELEVANCE: Record<string, { value: number; matcher: (fileName: string) => boolean }> = {
    repl: { value: 0, matcher: fileName => /^REPL\d+$/.test(fileName) },
    nodeInternals: { value: 0, matcher: fileName => /^node:[a-zA-Z\-_]/.test(fileName) },
    wdioInternals: { value: 1, matcher: fileName => fileName.includes("/node_modules/webdriverio/") },
    projectInternals: { value: 2, matcher: fileName => fileName.includes("/node_modules/") },
    userCode: { value: 3, matcher: () => true },
} as const;

export const getFrameRelevance = (frame: StackFrame): number => {
    if ([frame.fileName, frame.lineNumber, frame.columnNumber].some(_.isUndefined)) {
        return 0;
    }

    const fileName: string = softFileURLToPath(frame.fileName!);

    for (const factor in FRAME_RELEVANCE) {
        if (FRAME_RELEVANCE[factor].matcher(fileName)) {
            return FRAME_RELEVANCE[factor].value;
        }
    }

    return 0;
};

const getStackTraceRelevance = (error: Error): number => {
    const framesParsed = ErrorStackParser.parse(error);

    return framesParsed.reduce((maxRelevance, frame) => {
        return Math.max(maxRelevance, getFrameRelevance(frame));
    }, 0);
};

const createErrorWithStack = (stack: RawStackFrames, errorMessage = ""): Error => {
    const newError = new Error(errorMessage);

    newError.stack = getErrorTitle(newError) + "\n" + stack;

    return newError;
};

const applyStackTrace = (error: Error, stack: RawStackFrames): Error => {
    if (!error || !error.message) {
        return error;
    }

    error.stack = getErrorTitle(error) + "\n" + stack;

    return error;
};

export const applyStackTraceIfBetter = <T>(error: T, stack: RawStackFrames): T => {
    if (!error || !(error instanceof Error) || !error.message) {
        return error;
    }

    try {
        const newStackTraceRelevance = getStackTraceRelevance(createErrorWithStack(stack));
        const currentStackTraceRelevance = getStackTraceRelevance(error);

        if (newStackTraceRelevance > currentStackTraceRelevance) {
            applyStackTrace(error, stack);
        }
    } catch (err) {
        logger.warn("Couldn't compare error stack traces");
    }

    return error;
};

export const filterExtraStackFrames = (error: Error): Error => {
    if (!error || !error.message || !error.stack) {
        return error;
    }

    try {
        const rawFrames = getErrorRawStackFrames(error as ErrorWithStack);
        const rawFramesArr = rawFrames.split("\n").filter(frame => STACK_FRAME_REG_EXP.test(frame));
        const framesParsed = ErrorStackParser.parse(error);

        if (rawFramesArr.length !== framesParsed.length) {
            return error;
        }

        // If we found something more relevant (e.g. user's code), we can remove useless testplane internal frames
        // If we haven't, we keep testplane internal frames
        const shouldDropTestplaneInternalFrames =
            getStackTraceRelevance(error) > FRAME_RELEVANCE.projectInternals.value;

        const isIgnoredWebdriverioFrame = (frame: StackFrame): boolean => {
            const isWebdriverioFrame = frame.fileName && frame.fileName.includes("/node_modules/webdriverio/");
            const fnName = frame.functionName;

            if (!isWebdriverioFrame || !fnName) {
                return false;
            }

            return WDIO_IGNORED_STACK_FUNCTIONS.some(fn => fn === fnName || "async " + fn === fnName);
        };

        const isWdioUtilsFrame = (frame: StackFrame): boolean => {
            return Boolean(frame.fileName && frame.fileName.includes("/node_modules/@testplane/wdio-utils/"));
        };

        const isTestplaneExtraInternalFrame = (frame: StackFrame): boolean => {
            const testplaneExtraInternalFramePaths = [
                "/node_modules/testplane/src/browser/history/",
                "/node_modules/testplane/src/browser/stacktrace/",
            ];

            return Boolean(
                frame.fileName && testplaneExtraInternalFramePaths.some(path => frame.fileName?.includes(path)),
            );
        };

        const shouldIncludeFrame = (frame: StackFrame): boolean => {
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
    } catch (filterError) {
        logger.warn("Couldn't filter out wdio frames", filterError);

        return error;
    }
};

export class ShallowStackFrames {
    private _framesMap: Map<string, string>;
    private _key: number;

    constructor() {
        this._framesMap = new Map();
        this._key = 1;
    }

    getKey(): string {
        return String(this._key++);
    }

    enter(key: string, frames: string): void {
        this._framesMap.set(key, frames);
    }

    leave(key: string): void {
        this._framesMap.delete(key);
    }

    private _getParentStackFrame(childFrames: RawStackFrames): RawStackFrames | null {
        for (const parentFrames of this._framesMap.values()) {
            if (childFrames.length !== parentFrames.length && childFrames.endsWith(parentFrames)) {
                return parentFrames;
            }
        }

        return null;
    }

    areInternal(childFrames: RawStackFrames): boolean {
        const parentStackFrame = this._getParentStackFrame(childFrames);

        if (!parentStackFrame) {
            return false;
        }

        const isNodeModulesFrame = (frame: string): boolean => frame.includes("/node_modules/");
        const isNodeInternalFrame = (frame: string): boolean => frame.includes(" (node:");

        const extraFrames = childFrames.slice(0, childFrames.length - parentStackFrame.length);
        const extraFramesArray = extraFrames.split("\n");

        return extraFramesArray.every(frame => !frame || isNodeModulesFrame(frame) || isNodeInternalFrame(frame));
    }
}
