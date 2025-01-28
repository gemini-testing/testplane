"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLocationWithSourceMap = exports.extractSourceMaps = void 0;
const source_map_1 = require("source-map");
const url_1 = __importDefault(require("url"));
const constants_1 = require("./constants");
const utils_1 = require("./utils");
const fs_1 = require("../utils/fs");
const extractSourceMaps = async (fileContents, fileName) => {
    const sourceMapsStartIndex = fileContents.indexOf(constants_1.SOURCE_MAP_URL_COMMENT);
    const sourceMapsEndIndex = fileContents.indexOf("\n", sourceMapsStartIndex);
    if (sourceMapsStartIndex === -1) {
        return null;
    }
    const sourceMapUrl = sourceMapsEndIndex === -1
        ? fileContents.slice(sourceMapsStartIndex + constants_1.SOURCE_MAP_URL_COMMENT.length)
        : fileContents.slice(sourceMapsStartIndex + constants_1.SOURCE_MAP_URL_COMMENT.length, sourceMapsEndIndex);
    const sourceMaps = await (0, utils_1.getSourceCodeFile)(url_1.default.resolve(fileName, sourceMapUrl));
    return new source_map_1.SourceMapConsumer(sourceMaps);
};
exports.extractSourceMaps = extractSourceMaps;
const resolveLocationWithSourceMap = (stackFrame, sourceMaps) => {
    const positions = sourceMaps.originalPositionFor({ line: stackFrame.lineNumber, column: stackFrame.columnNumber });
    const source = positions.source ? sourceMaps.sourceContentFor(positions.source) : null;
    const location = { line: positions.line, column: positions.column };
    if (!source) {
        throw new Error("File source code could not be evaluated from the source map");
    }
    if (!location.line || !location.column) {
        throw new Error("Line and column could not be evaluated from the source map");
    }
    return { file: (0, fs_1.softFileURLToPath)(sourceMaps.file), source, location };
};
exports.resolveLocationWithSourceMap = resolveLocationWithSourceMap;
//# sourceMappingURL=source-maps.js.map