import ErrorStackParser from "error-stack-parser";
import type { SetRequired } from "type-fest";
import logger from "../../utils/logger";
import { WDIO_IGNORED_STACK_FUNCTIONS, WDIO_STACK_TRACE_LIMIT } from "./constants";

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

    return e.stack.slice(errorMessageEndsStackIndex + 1);
};

export function captureRawStackFrames(filterFunc?: (...args: unknown[]) => unknown): RawStackFrames {
    const savedStackTraceLimit = Error.stackTraceLimit;
    const targetObj = {} as { stack: RawStackFrames };

    Error.stackTraceLimit = WDIO_STACK_TRACE_LIMIT;
    Error.captureStackTrace(targetObj, filterFunc || captureRawStackFrames);
    Error.stackTraceLimit = savedStackTraceLimit;

    const rawFramesPosition = targetObj.stack.indexOf("\n") + 1; // crop out error message

    return targetObj.stack.slice(rawFramesPosition);
}

export function applyStackFrames(error: Error, frames: RawStackFrames): Error {
    if (!error || !error.message) {
        return error;
    }

    error.stack = getErrorTitle(error) + "\n" + frames;

    return error;
}

export function filterExtraWdioFrames(error: Error): Error {
    if (!error || !error.message || !error.stack) {
        return error;
    }

    try {
        const rawFrames = getErrorRawStackFrames(error as ErrorWithStack);
        const rawFramesArr = rawFrames.split("\n");
        const framesParsed = ErrorStackParser.parse(error);

        if (rawFramesArr.length !== framesParsed.length) {
            return error;
        }

        const isWdioFrame = (frame: StackFrame): boolean => {
            return Boolean(frame.fileName && frame.fileName.includes("/node_modules/webdriverio/"));
        };

        const isIgnoredFunction = (frame: StackFrame): boolean => {
            const funcName = frame.functionName;

            if (!funcName) {
                return false;
            }

            return Boolean(WDIO_IGNORED_STACK_FUNCTIONS.some(fn => fn === funcName || "async " + fn === funcName));
        };

        const shouldIncludeFrame = (frame: StackFrame): boolean => !isWdioFrame(frame) || !isIgnoredFunction(frame);

        const framesFiltered = rawFramesArr.filter((_, i) => shouldIncludeFrame(framesParsed[i])).join("\n");

        return applyStackFrames(error, framesFiltered);
    } catch (filterError) {
        logger.warn("Couldn't filter out wdio frames", filterError);

        return error;
    }
}

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

    isNested(childFrames: RawStackFrames): boolean {
        for (const parentFrames of this._framesMap.values()) {
            if (childFrames.length !== parentFrames.length && childFrames.endsWith(parentFrames)) {
                return true;
            }
        }

        return false;
    }
}
