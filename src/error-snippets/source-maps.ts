import { SourceMapConsumer, type BasicSourceMapConsumer } from "source-map";
import url from "url";
import { SOURCE_MAP_URL_COMMENT } from "./constants";
import { softFileURLToPath, getSourceCodeFile } from "./utils";
import type { SufficientStackFrame, ResolvedFrame } from "./types";

export const extractSourceMaps = async (
    fileContents: string,
    fileName: string,
): Promise<BasicSourceMapConsumer | null> => {
    const sourceMapsStartIndex = fileContents.indexOf(SOURCE_MAP_URL_COMMENT);
    const sourceMapsEndIndex = fileContents.indexOf("\n", sourceMapsStartIndex);

    if (sourceMapsStartIndex === -1) {
        return null;
    }

    const sourceMapUrl =
        sourceMapsEndIndex === -1
            ? fileContents.slice(sourceMapsStartIndex + SOURCE_MAP_URL_COMMENT.length)
            : fileContents.slice(sourceMapsStartIndex + SOURCE_MAP_URL_COMMENT.length, sourceMapsEndIndex);

    const sourceMaps = await getSourceCodeFile(url.resolve(fileName, sourceMapUrl));

    return new SourceMapConsumer(sourceMaps) as Promise<BasicSourceMapConsumer>;
};

export const resolveLocationWithSourceMap = (
    stackFrame: SufficientStackFrame,
    sourceMaps: BasicSourceMapConsumer,
): ResolvedFrame => {
    const positions = sourceMaps.originalPositionFor({ line: stackFrame.lineNumber, column: stackFrame.columnNumber });
    const source = positions.source ? sourceMaps.sourceContentFor(positions.source) : null;
    const location = { line: positions.line!, column: positions.column! };

    if (!source) {
        throw new Error("File source code could not be evaluated from the source map");
    }

    if (!location.line || !location.column) {
        throw new Error("Line and column could not be evaluated from the source map");
    }

    return { file: softFileURLToPath(sourceMaps.file), source, location };
};
