import _ from "lodash";
import ErrorStackParser from "error-stack-parser";
import logger from "../utils/logger";
import { softFileURLToPath } from "./utils";
import type { ResolvedFrame, SufficientStackFrame } from "./types";

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
const FRAME_REELVANCE: Record<string, { value: number; matcher: (fileName: string) => boolean }> = {
    repl: { value: 0, matcher: fileName => /^REPL\d+$/.test(fileName) },
    nodeInternals: { value: 0, matcher: fileName => /^node:[a-zA-Z\-_]/.test(fileName) },
    wdioInternals: { value: 1, matcher: fileName => fileName.includes("/node_modules/webdriverio/") },
    projectInternals: { value: 2, matcher: fileName => fileName.includes("/node_modules/") },
    userCode: { value: 3, matcher: () => true },
} as const;

const getFrameRelevance = (frame: StackFrame): number => {
    if ([frame.fileName, frame.lineNumber, frame.columnNumber].some(_.isUndefined)) {
        return 0;
    }

    const fileName: string = softFileURLToPath(frame.fileName!);

    for (const factor in FRAME_REELVANCE) {
        if (FRAME_REELVANCE[factor].matcher(fileName)) {
            return FRAME_REELVANCE[factor].value;
        }
    }

    return 0;
};

export const findRelevantStackFrame = (error: Error): SufficientStackFrame | null => {
    try {
        const parsedStackFrames = ErrorStackParser.parse(error);

        let relevantFrame: SufficientStackFrame | null = null;
        let relevantFrameRank = 0;

        for (const currentFrame of parsedStackFrames) {
            const currentFrameRank = getFrameRelevance(currentFrame);

            if (currentFrameRank > relevantFrameRank) {
                relevantFrame = currentFrame as SufficientStackFrame;
                relevantFrameRank = currentFrameRank;
            }
        }

        return relevantFrame;
    } catch (findError) {
        logger.warn("Unable to find relevant stack frame:", findError);

        return null;
    }
};

export const resolveLocationWithStackFrame = (
    stackFrame: SufficientStackFrame,
    fileContents: string,
): ResolvedFrame => ({
    file: softFileURLToPath(stackFrame.fileName),
    source: fileContents,
    location: { line: stackFrame.lineNumber, column: stackFrame.columnNumber },
});
