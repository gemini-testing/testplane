import { RawSourceMap, SourceMapConsumer } from "source-map-js";
import url from "url";
import { JS_SOURCE_MAP_URL_COMMENT } from "./constants";
import { getSourceCodeFile } from "./utils";
import { softFileURLToPath } from "../utils/fs";
import { transformCode } from "../utils/typescript";
import type { SufficientStackFrame, ResolvedFrame } from "./types";

export const extractSourceMaps = async (fileContents: string, fileName: string): Promise<SourceMapConsumer | null> => {
    const hasNoSourceMaps = fileContents.indexOf(JS_SOURCE_MAP_URL_COMMENT) === -1;
    const isEsmFile = fileName.startsWith("file://");

    if (hasNoSourceMaps && !isEsmFile) {
        fileContents = transformCode(fileContents, { sourceFile: fileName, sourceMaps: true });
    }

    const sourceMapsStartIndex = fileContents.lastIndexOf(JS_SOURCE_MAP_URL_COMMENT);
    const sourceMapsEndIndex = fileContents.indexOf("\n", sourceMapsStartIndex);

    if (sourceMapsStartIndex === -1) {
        return null;
    }

    const sourceMapUrl =
        sourceMapsEndIndex === -1
            ? fileContents.slice(sourceMapsStartIndex + JS_SOURCE_MAP_URL_COMMENT.length)
            : fileContents.slice(sourceMapsStartIndex + JS_SOURCE_MAP_URL_COMMENT.length, sourceMapsEndIndex);

    const sourceMaps = await getSourceCodeFile(url.resolve(fileName, sourceMapUrl));
    const rawSourceMaps = JSON.parse(sourceMaps) as RawSourceMap;

    rawSourceMaps.file = rawSourceMaps.file || fileName;

    return new SourceMapConsumer(rawSourceMaps);
};

export const resolveLocationWithSourceMap = (
    stackFrame: SufficientStackFrame,
    sourceMaps: SourceMapConsumer,
): ResolvedFrame => {
    const positions = sourceMaps.originalPositionFor({ line: stackFrame.lineNumber, column: stackFrame.columnNumber });
    const source = positions.source ? sourceMaps.sourceContentFor(positions.source) : null;
    const location = { line: positions.line!, column: positions.column! };

    if (!source) {
        const lines: string[] = [];
        lines.push("What happened: Source code could not be retrieved from the source map for this stack frame.");
        lines.push("\nPossible reasons:");
        lines.push("  - The source map does not include 'sourcesContent' for the referenced file");
        lines.push("  - The source file path in the source map points to a non-existent file");
        lines.push("  - The source map was generated without embedding source contents");
        lines.push("\nWhat you can do:");
        lines.push("  - Regenerate the source maps with 'sourcesContent: true' (e.g. in webpack/vite config)");
        lines.push("  - Ensure that the source files referenced in the source map are accessible on disk");
        throw new Error(lines.join("\n"));
    }

    if (!location.line || !location.column) {
        const lines: string[] = [];
        lines.push(
            "What happened: Could not resolve a valid line/column position from the source map for this stack frame.",
        );
        lines.push("\nPossible reasons:");
        lines.push("  - The source map mapping for this code location is incomplete or missing");
        lines.push("  - The original source position corresponds to a generated preamble with no original location");
        lines.push("\nWhat you can do:");
        lines.push(
            "  - Check if the source map is complete and was generated from the same build as the executed code",
        );
        lines.push("  - Regenerate the source maps to ensure all code positions have valid mappings");
        throw new Error(lines.join("\n"));
    }

    return { file: softFileURLToPath(sourceMaps.file as string), source, location };
};
