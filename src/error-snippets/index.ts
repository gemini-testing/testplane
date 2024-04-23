import { findRelevantStackFrame, resolveLocationWithStackFrame } from "./frames";
import { extractSourceMaps, resolveLocationWithSourceMap } from "./source-maps";
import { getSourceCodeFile, formatErrorSnippet } from "./utils";
import logger from "../utils/logger";
import type { ResolvedFrame, SufficientStackFrame, WithSnippetError } from "./types";

const stackFrameLocationResolver = async (stackFrame: SufficientStackFrame): Promise<ResolvedFrame> => {
    const fileContents = await getSourceCodeFile(stackFrame.fileName);
    const sourceMaps = await extractSourceMaps(fileContents, stackFrame.fileName);

    return sourceMaps
        ? resolveLocationWithSourceMap(stackFrame, sourceMaps)
        : resolveLocationWithStackFrame(stackFrame, fileContents);
};

export const extendWithCodeSnippet = async (err: WithSnippetError): Promise<WithSnippetError> => {
    if (!err) {
        return err;
    }

    try {
        const relevantStackFrame = findRelevantStackFrame(err);

        if (!relevantStackFrame) {
            return err;
        }

        const { file, source, location } = await stackFrameLocationResolver(relevantStackFrame);

        err.snippet = formatErrorSnippet(err, { file, source, location });

        return err;
    } catch (snippetError) {
        logger.warn("Unable to apply code snippet:", snippetError);

        return err;
    }
};
