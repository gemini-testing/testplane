import path from "path";
import fs from "fs-extra";
import { codeFrameColumns } from "@babel/code-frame";
import { getErrorTitle } from "../browser/stacktrace/utils";
import { SNIPPET_LINES_ABOVE, SNIPPET_LINES_BELOW, JS_SOURCE_MAP_URL_COMMENT } from "./constants";
import { AssertViewError } from "../browser/commands/assert-view/errors/assert-view-error";
import { BaseStateError } from "../browser/commands/assert-view/errors/base-state-error";
import { softFileURLToPath } from "../utils/fs";

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

export const shouldNotAddCodeSnippet = (err: Error): boolean => {
    if (!err) {
        return true;
    }

    const isScreenshotError = [AssertViewError, BaseStateError].some(errorClass => err instanceof errorClass);

    return isScreenshotError;
};

const trimAsyncPrefix = (fileName: string): string => {
    const asyncPrefix = "async ";
    return fileName.startsWith(asyncPrefix) ? fileName.slice(asyncPrefix.length) : fileName;
};

export const formatFileNameHeader = (fileName: string, opts: FormatFileNameHeaderOpts): string => {
    const lineNumberWidth = String(opts.line - opts.linesAbove).length;
    const offsetWidth = String(opts.line + opts.linesBelow).length;

    const filePath = softFileURLToPath(trimAsyncPrefix(fileName));
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
    const filePath = softFileURLToPath(trimAsyncPrefix(fileName));

    if (path.isAbsolute(filePath)) {
        return fs.readFile(filePath, "utf8");
    }

    const response = await fetch(filePath);
    const responseText = await response.text();

    if (responseText.includes(JS_SOURCE_MAP_URL_COMMENT) || !response.headers.has("SourceMap")) {
        return responseText;
    }

    const sourceMapUrl = response.headers.get("SourceMap");

    return responseText + "\n" + JS_SOURCE_MAP_URL_COMMENT + sourceMapUrl;
};
