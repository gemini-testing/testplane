import ErrorStackParser from "error-stack-parser";
import * as logger from "../utils/logger";
import { getFrameRelevance } from "../browser/stacktrace/utils";
import type { ResolvedFrame, SufficientStackFrame } from "./types";
import { softFileURLToPath } from "../utils/fs";

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
