"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STACK_FRAME_REG_EXP = exports.WDIO_IGNORED_STACK_FUNCTIONS = exports.WDIO_STACK_TRACE_LIMIT = void 0;
exports.WDIO_STACK_TRACE_LIMIT = 64;
exports.WDIO_IGNORED_STACK_FUNCTIONS = [
    "Browser.wrapCommandFn",
    "Element.wrapCommandFn",
    "Element.<anonymous>",
    "Element.newCommand",
    "Element.elementErrorHandlerCallbackFn",
];
// Other frames are being filtered out by error-stack-parser
// Declared at https://github.com/stacktracejs/error-stack-parser/blob/v2.1.4/error-stack-parser.js#L17
// Used at https://github.com/stacktracejs/error-stack-parser/blob/v2.1.4/error-stack-parser.js#L52-L54
exports.STACK_FRAME_REG_EXP = /^\s*at .*(\S+:\d+|\(native\))/m;
//# sourceMappingURL=constants.js.map