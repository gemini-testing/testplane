"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSourceCodeFile = exports.formatErrorSnippet = exports.formatFileNameHeader = exports.shouldNotAddCodeSnippet = void 0;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const code_frame_1 = require("@babel/code-frame");
const utils_1 = require("../browser/stacktrace/utils");
const constants_1 = require("./constants");
const assert_view_error_1 = require("../browser/commands/assert-view/errors/assert-view-error");
const base_state_error_1 = require("../browser/commands/assert-view/errors/base-state-error");
const fs_1 = require("../utils/fs");
const shouldNotAddCodeSnippet = (err) => {
    if (!err) {
        return true;
    }
    const isScreenshotError = [assert_view_error_1.AssertViewError, base_state_error_1.BaseStateError].some(errorClass => err instanceof errorClass);
    return isScreenshotError;
};
exports.shouldNotAddCodeSnippet = shouldNotAddCodeSnippet;
const trimAsyncPrefix = (fileName) => {
    const asyncPrefix = "async ";
    return fileName.startsWith(asyncPrefix) ? fileName.slice(asyncPrefix.length) : fileName;
};
const formatFileNameHeader = (fileName, opts) => {
    const lineNumberWidth = String(opts.line - opts.linesAbove).length;
    const offsetWidth = String(opts.line + opts.linesBelow).length;
    const filePath = (0, fs_1.softFileURLToPath)(trimAsyncPrefix(fileName));
    const relativeFileName = path_1.default.isAbsolute(filePath) ? path_1.default.relative(process.cwd(), filePath) : filePath;
    const lineNumberOffset = ".".repeat(lineNumberWidth).padStart(offsetWidth);
    const offset = `  ${lineNumberOffset} |`;
    const grayBegin = "\x1B[90m";
    const grayEnd = "\x1B[39m";
    return [offset + ` // ${relativeFileName}`, offset].map(line => grayBegin + line + grayEnd + "\n").join("");
};
exports.formatFileNameHeader = formatFileNameHeader;
const formatErrorSnippet = (error, { file, source, location }) => {
    const linesAbove = constants_1.SNIPPET_LINES_ABOVE;
    const linesBelow = constants_1.SNIPPET_LINES_BELOW;
    const formattedFileNameHeader = (0, exports.formatFileNameHeader)(file, { linesAbove, linesBelow, line: location.line });
    const snippet = formattedFileNameHeader +
        (0, code_frame_1.codeFrameColumns)(source, { start: location }, {
            linesAbove,
            linesBelow,
            message: (0, utils_1.getErrorTitle)(error),
            highlightCode: true,
            forceColor: true,
        });
    return `\n${snippet}\n`;
};
exports.formatErrorSnippet = formatErrorSnippet;
const getSourceCodeFile = async (fileName) => {
    const filePath = (0, fs_1.softFileURLToPath)(trimAsyncPrefix(fileName));
    if (path_1.default.isAbsolute(filePath)) {
        return fs_extra_1.default.readFile(filePath, "utf8");
    }
    const response = await fetch(filePath);
    const responseText = await response.text();
    if (responseText.includes(constants_1.SOURCE_MAP_URL_COMMENT) || !response.headers.has("SourceMap")) {
        return responseText;
    }
    const sourceMapUrl = response.headers.get("SourceMap");
    return responseText + "\n" + constants_1.SOURCE_MAP_URL_COMMENT + sourceMapUrl;
};
exports.getSourceCodeFile = getSourceCodeFile;
//# sourceMappingURL=utils.js.map