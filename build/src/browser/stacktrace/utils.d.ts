export type RawStackFrames = string;
export declare const getErrorTitle: (e: Error) => string;
export declare const captureRawStackFrames: (filterFunc?: ((...args: unknown[]) => unknown) | undefined) => RawStackFrames;
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
export declare const FRAME_RELEVANCE: Record<string, {
    value: number;
    matcher: (fileName: string) => boolean;
}>;
export declare const getFrameRelevance: (frame: StackFrame) => number;
export declare const applyStackTraceIfBetter: <T>(error: T, stack: RawStackFrames) => T;
export declare const filterExtraStackFrames: (error: Error) => Error;
export declare class ShallowStackFrames {
    private _framesMap;
    private _key;
    constructor();
    getKey(): string;
    enter(key: string, frames: string): void;
    leave(key: string): void;
    private _getParentStackFrame;
    areInternal(childFrames: RawStackFrames): boolean;
}
