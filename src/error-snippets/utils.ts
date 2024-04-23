import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { codeFrameColumns } from "@babel/code-frame";
import { getErrorTitle } from "../browser/stacktrace/utils";
import { SNIPPET_LINES_ABOVE, SNIPPET_LINES_BELOW, SOURCE_MAP_URL_COMMENT } from "./constants";

interface FormatFileNameHeaderOpts {
    line: number;
    linesAbove: number;
    linesBelow: number;
}

interface FormatErrorSnippetOpts {
    file: string;
    source: string;
    location: { line: number; column: number };
}

export const softFileURLToPath = (fileName: string): string => {
    if (!fileName.startsWith("file://")) {
        return fileName;
    }

    try {
        return fileURLToPath(fileName);
    } catch (_) {
        return fileName;
    }
};

export const formatFileNameHeader = (fileName: string, opts: FormatFileNameHeaderOpts): string => {
    const lineNumberWidth = String(opts.line - opts.linesAbove).length;
    const offsetWidth = String(opts.line + opts.linesBelow).length;

    const filePath = softFileURLToPath(fileName);
    const relativeFileName = path.isAbsolute(filePath) ? path.relative(process.cwd(), filePath) : filePath;
    const lineNumberOffset = ".".repeat(lineNumberWidth).padStart(offsetWidth);
    const offset = `  ${lineNumberOffset} |`;
    const grayBegin = "\x1B[90m";
    const grayEnd = "\x1B[39m";

    return [offset + ` // ${relativeFileName}`, offset].map(line => grayBegin + line + grayEnd + "\n").join("");
};

export const formatErrorSnippet = (error: Error, { file, source, location }: FormatErrorSnippetOpts): string => {
    const linesAbove = SNIPPET_LINES_ABOVE;
    const linesBelow = SNIPPET_LINES_BELOW;
    const formattedFileNameHeader = formatFileNameHeader(file, { linesAbove, linesBelow, line: location.line });

    const snippet =
        formattedFileNameHeader +
        codeFrameColumns(
            source,
            { start: location },
            {
                linesAbove,
                linesBelow,
                message: getErrorTitle(error),
                highlightCode: true,
                forceColor: true,
            },
        );

    return `\n${snippet}\n`;
};

export const getSourceCodeFile = async (fileName: string): Promise<string> => {
    const filePath = softFileURLToPath(fileName);

    if (path.isAbsolute(filePath)) {
        return fs.readFile(filePath, "utf8");
    }

    const response = await fetch(filePath);
    const responseText = await response.text();

    if (responseText.includes(SOURCE_MAP_URL_COMMENT) || !response.headers.has("SourceMap")) {
        return responseText;
    }

    const sourceMapUrl = response.headers.get("SourceMap");

    return responseText + "\n" + SOURCE_MAP_URL_COMMENT + sourceMapUrl;
};
