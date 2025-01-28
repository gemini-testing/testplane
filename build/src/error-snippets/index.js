"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extendWithCodeSnippet = void 0;
const frames_1 = require("./frames");
const source_maps_1 = require("./source-maps");
const utils_1 = require("./utils");
const stackFrameLocationResolver = async (stackFrame) => {
    const fileContents = await (0, utils_1.getSourceCodeFile)(stackFrame.fileName);
    const sourceMaps = await (0, source_maps_1.extractSourceMaps)(fileContents, stackFrame.fileName);
    return sourceMaps
        ? (0, source_maps_1.resolveLocationWithSourceMap)(stackFrame, sourceMaps)
        : (0, frames_1.resolveLocationWithStackFrame)(stackFrame, fileContents);
};
const extendWithCodeSnippet = async (err) => {
    try {
        if ((0, utils_1.shouldNotAddCodeSnippet)(err)) {
            return err;
        }
        const relevantStackFrame = (0, frames_1.findRelevantStackFrame)(err);
        if (!relevantStackFrame) {
            return err;
        }
        const { file, source, location } = await stackFrameLocationResolver(relevantStackFrame);
        err.snippet = (0, utils_1.formatErrorSnippet)(err, { file, source, location });
        return err;
    }
    catch (snippetError) {
        return err;
    }
};
exports.extendWithCodeSnippet = extendWithCodeSnippet;
//# sourceMappingURL=index.js.map